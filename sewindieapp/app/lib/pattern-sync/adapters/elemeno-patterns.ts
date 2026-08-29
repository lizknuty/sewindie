import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Elemeno Patterns (elemenopatterns.com)
// ---------------------------------------------------------------------------
// A Wix Stores site, no existing rows -- a fresh backfill. Wix has no public
// product JSON API, but it publishes a products sitemap
// (`/store-products-sitemap.xml`) listing every product page, and each product
// page carries clean Open Graph + JSON-LD metadata. So: crawl the sitemap for
// product URLs, fetch each page, and read the name/image from its meta tags.
//
// Extraction, in priority order per page:
//   1. og:title (reliably present, minus the " | elemenopatterns" suffix)
//   2. JSON-LD Product.name (fallback)
//   3. slug title-cased (last resort -- one product, "hipster-romper", is a
//      hidden/sold-out shell that renders an empty page with no meta at all;
//      the slug still gives a sensible "Hipster Romper")
// Image: og:image, then JSON-LD Product.image.
//
// Every product in the store is a children's-garment PDF pattern (no fabric,
// notions, kits or gift cards), so all are kind "pattern". The sitemap's
// <lastmod> is a single 2019 batch date (sitemap regeneration, not a per-product
// release), so releaseDate is null. identityKey = the product slug.
// ---------------------------------------------------------------------------

const STORE = "https://www.elemenopatterns.com"
const PRODUCTS_SITEMAP = `${STORE}/store-products-sitemap.xml`

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const REQUEST_TIMEOUT_MS = 15_000
const CONCURRENCY = 8
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 300
const TITLE_SUFFIX = /\s*\|\s*elemenopatterns\s*$/i
const BUNDLE_TITLE = /\bbundles?\b/i

export type ElemenoProductPage = {
  url: string
  html: string
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&#8217;|&#x2019;/gi, "\u2019")
    .replace(/&#8216;|&#x2018;/gi, "\u2018")
    .replace(/&#8211;|&#x2013;/gi, "\u2013")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Last path segment of a product URL, e.g.
// ".../product-page/cross-back-dress" -> "cross-back-dress". Exported for the
// verify script's offline unit tests.
export function elemenoSlug(url: string): string {
  return url
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop() as string
}

// "hipster-romper" -> "Hipster Romper". Fallback name when a page has no
// usable meta (hidden/sold-out shells). Hyphens are word separators here (the
// slug has already lost any real intra-word hyphens), so title-case every word.
// Exported for unit tests.
export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim()
}

function metaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match && match[1]) return decodeEntities(match[1])
  }
  return null
}

function jsonLdProduct(html: string): { name?: string; image?: string } | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1])
      const graph = Array.isArray(parsed) ? parsed : Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]
      const product = graph.find((node: { "@type"?: string | string[] }) => {
        const type = node?.["@type"]
        return type === "Product" || (Array.isArray(type) && type.includes("Product"))
      })
      if (product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image
        return { name: product.name ? decodeEntities(String(product.name)) : undefined, image }
      }
    } catch {
      // Wix embeds several JSON-LD blocks; ignore the ones that don't parse.
    }
  }
  return null
}

function classify(name: string): ProductKind {
  return BUNDLE_TITLE.test(name) ? "bundle" : "pattern"
}

// Turn a fetched product page into a ScrapedPattern using the priority chain
// described in the header. Exported for the verify script's offline unit tests.
export function parseProductPage(page: ElemenoProductPage): ScrapedPattern {
  const slug = elemenoSlug(page.url)
  const ld = jsonLdProduct(page.html)
  const ogTitle = metaContent(page.html, "og:title")
  const name = (ogTitle ? ogTitle.replace(TITLE_SUFFIX, "").trim() : "") || ld?.name?.trim() || slugToTitle(slug)
  const imageUrl = metaContent(page.html, "og:image") || ld?.image || null

  return {
    name,
    url: page.url,
    imageUrl,
    releaseDate: null, // sitemap <lastmod> is a batch date, not a release date
    kind: classify(name),
    sourceId: slug,
  }
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1) * 2))
        continue
      }
      if (!res.ok) throw new Error(`${res.status} for ${url}`)
      return await res.text()
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES - 1) await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`)
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export const elemenoPatternsAdapter: DesignerAdapter = {
  slug: "elemeno-patterns",
  label: "Elemeno Patterns",
  matchHosts: ["elemenopatterns.com", "www.elemenopatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const sitemap = await fetchText(PRODUCTS_SITEMAP)
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].trim())
      .filter((u) => /\/product-page\//i.test(u))

    const uniqueUrls = [...new Set(urls)]
    const pages = await mapWithConcurrency(uniqueUrls, CONCURRENCY, async (url) => ({
      url,
      html: await fetchText(url),
    }))

    return pages.map(parseProductPage)
  },
}
