import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Fitiyoo (fitiyoo.com)
// ---------------------------------------------------------------------------
// A French lingerie/swimwear pattern brand on a bespoke platform (no Shopify /
// Woo / Wix / Squarespace API). It does publish a full `/sitemap.xml`, and its
// product pages carry clean Open Graph + JSON-LD (@type "product") metadata.
// So: read the sitemap, keep only the product leaf URLs, fetch each page, and
// extract name/image/price from its meta.
//
//  1. PRODUCT URLS ARE THE LEAVES UNDER /en/lingerie-sewing-patterns/. The
//     English catalogue lives at
//     "/en/lingerie-sewing-patterns/<category>/<slug>" (categories: maillots,
//     panties, bras, body). Two-segment tails are the product leaves (23 of
//     them); the one-segment category index pages and the gift-card page are
//     excluded by requiring exactly <category>/<slug>. We use the /en/ tree so
//     names come through in English.
//
//  2. NAME / IMAGE / DATE. og:title (minus the " | Fitiyoo" suffix), falling
//     back to JSON-LD Product.name; og:image (falling back to JSON-LD image).
//     Product pages expose no reliable publish date, so releaseDate is null.
//     identityKey = the product slug. Free patterns (e.g. the "... free
//     pattern" triangle bra) are still kind "pattern".
// ---------------------------------------------------------------------------

const STORE = "https://www.fitiyoo.com"
const SITEMAP = `${STORE}/sitemap.xml`
const CATEGORY_PREFIX = "/en/lingerie-sewing-patterns/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const REQUEST_TIMEOUT_MS = 15_000
const CONCURRENCY = 8
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 300
const TITLE_SUFFIX = /\s*\|\s*fitiyoo\s*$/i
const BUNDLE_TITLE = /\bbundles?\b/i

export type FitiyooProductPage = {
  url: string
  html: string
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&#8217;|&#x2019;/gi, "\u2019")
    .replace(/&#8211;|&#x2013;/gi, "\u2013")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Is this sitemap URL an English product leaf ("<category>/<slug>" under the
// patterns tree)? Exported for the verify script's offline unit tests.
export function isProductUrl(url: string): boolean {
  const idx = url.indexOf(CATEGORY_PREFIX)
  if (idx === -1) return false
  const tail = url
    .slice(idx + CATEGORY_PREFIX.length)
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "")
  const segments = tail.split("/").filter(Boolean)
  return segments.length === 2 // <category>/<slug>, not the category index
}

// Last path segment. Exported for the verify script's offline unit tests.
export function fitiyooSlug(url: string): string {
  return url
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop() as string
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
        // Fitiyoo uses a lower-case "product" @type.
        const norm = (t: string) => t.toLowerCase() === "product"
        return typeof type === "string" ? norm(type) : Array.isArray(type) && type.some(norm)
      })
      if (product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image
        return { name: product.name ? decodeEntities(String(product.name)) : undefined, image }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return null
}

function classify(name: string): ProductKind {
  return BUNDLE_TITLE.test(name) ? "bundle" : "pattern"
}

// Turn a fetched product page into a ScrapedPattern. Exported for unit tests.
export function parseProductPage(page: FitiyooProductPage): ScrapedPattern {
  const slug = fitiyooSlug(page.url)
  const ld = jsonLdProduct(page.html)
  const ogTitle = metaContent(page.html, "og:title")
  const name = (ogTitle ? ogTitle.replace(TITLE_SUFFIX, "").trim() : "") || ld?.name?.trim() || slug
  const imageUrl = metaContent(page.html, "og:image") || ld?.image || null

  return {
    name,
    url: page.url,
    imageUrl,
    releaseDate: null,
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

export const fitiyooAdapter: DesignerAdapter = {
  slug: "fitiyoo",
  label: "Fitiyoo",
  matchHosts: ["fitiyoo.com", "www.fitiyoo.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const sitemap = await fetchText(SITEMAP)
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter(isProductUrl)

    const uniqueUrls = [...new Set(urls)]
    const pages = await mapWithConcurrency(uniqueUrls, CONCURRENCY, async (url) => ({
      url,
      html: await fetchText(url),
    }))

    return pages.map(parseProductPage)
  },
}
