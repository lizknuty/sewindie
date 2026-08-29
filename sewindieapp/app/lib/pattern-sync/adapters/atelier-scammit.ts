import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Atelier Scammit (atelier-scammit.com)
// ---------------------------------------------------------------------------
// A PrestaShop site, no existing rows -- a fresh backfill. PrestaShop here has
// no product JSON API and no XML sitemap (all 404), so we crawl:
//
//   1. Read the homepage and discover category listing URLs (links shaped
//      `/<id>-<slug>`, e.g. `/8-women`, `/11-kids`, `/38-discontinued-patterns`).
//   2. Crawl every category with `?page=N` pagination, collecting canonical
//      product URLs (shaped `/<category>/<id>-<slug>.html`). Category pages also
//      cross-link a "you may also like" carousel, which HELPS discovery -- taking
//      the union across all categories yields the full ~83-product catalogue.
//   3. Fetch each product page and read its own `<h1>` -- the reliable main
//      product name. (JSON-LD is NOT reliable: each page embeds ~12 Product
//      blocks for the related-products carousel, and the page's own block is not
//      consistently first or URL-matchable. The `<h1>` is unambiguous.)
//
// Decisions:
//  - NAME: the `<h1>` is ALL-CAPS ("DECLIC", "MOBILE COEURS"); title-case it to
//    "Declic" / "Mobile Coeurs". (Site renders accents as ASCII, so nothing is
//    lost.) No existing rows, so this sets the convention.
//  - IMAGE: og:image (present and correct on every product page).
//  - IDENTITY: the PrestaShop numeric product id from the URL (`/124-declic.html`
//    -> "124"). Ids are permanent in PrestaShop; the slug/category can change, so
//    the id is the stable identity for reconciliation.
//  - KIND: nearly everything is a sewing pattern (garments, plus pouches / baby
//    baskets / mobiles, which are sewing projects with patterns). Only obvious
//    non-patterns -- woven-label kits, gift cards, haberdashery/notions -- are
//    flagged `kind:"other"` (NOT dropped; the admin decides).
//  - DATE: PrestaShop exposes no reliable per-product publish date here -> null.
// ---------------------------------------------------------------------------

const STORE = "https://www.atelier-scammit.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const REQUEST_TIMEOUT_MS = 18_000
const CONCURRENCY = 10
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 300
const MAX_CATEGORY_PAGES = 6

// Category URL segments (or product-name matches) that are not sewing patterns.
const NON_PATTERN_SEGMENTS = new Set(["woven-labels", "gift-cards", "haberdashery"])
const NON_PATTERN_NAME = /\b(gift card|carte cadeau|woven label|haberdashery|e-?gift)\b/i
const BUNDLE_NAME = /\b(bundle|family pack|set of|lot de)\b/i

const PRODUCT_URL_RE = /https:\/\/www\.atelier-scammit\.com\/[a-z0-9-]+\/\d+-[a-z0-9-]+\.html/gi
const CATEGORY_URL_RE = /href="(https:\/\/www\.atelier-scammit\.com\/\d+-[a-z0-9-]+)"/gi

export type ScammitProductPage = {
  url: string
  html: string
}

// PrestaShop numeric product id: "/women/124-declic.html" -> "124". Exported
// for the verify script's offline unit tests.
export function scammitProductId(url: string): string | null {
  const match = url.match(/\/(\d+)-[a-z0-9-]+\.html/i)
  return match ? match[1] : null
}

// First URL path segment: "/home-decor/53-mobile-coeurs.html" -> "home-decor".
export function scammitSegment(url: string): string {
  return url.replace(/^https?:\/\/[^/]+\//, "").split("/")[0]
}

// "MOBILE COEURS" -> "Mobile Coeurs". Exported for unit tests.
export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractH1(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!match) return null
  const text = match[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text || null
}

function extractOgImage(html: string): string | null {
  const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
  return match ? match[1].trim() : null
}

// Exported for the verify script's offline unit tests.
export function classify(name: string, segment: string): ProductKind {
  if (NON_PATTERN_SEGMENTS.has(segment) || NON_PATTERN_NAME.test(name)) return "other"
  if (BUNDLE_NAME.test(name)) return "bundle"
  return "pattern"
}

// Turn a fetched product page into a ScrapedPattern. Returns null if the page
// has no usable name. Exported for the verify script's offline unit tests.
export function parseProductPage(page: ScammitProductPage): ScrapedPattern | null {
  const id = scammitProductId(page.url)
  const h1 = extractH1(page.html)
  if (!id || !h1) return null

  const name = titleCase(h1)
  const segment = scammitSegment(page.url)

  return {
    name,
    url: page.url,
    imageUrl: extractOgImage(page.html),
    releaseDate: null, // no reliable per-product date on PrestaShop here
    kind: classify(name, segment),
    sourceId: id,
  }
}

async function fetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "follow",
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

// Discover product URLs by crawling every category listing (paginated) and
// taking the union of canonical product links. Exported for the verify script.
export async function discoverProductUrls(): Promise<string[]> {
  const homepage = await fetchText(`${STORE}/`)
  const categoryUrls = [...new Set([...homepage.matchAll(CATEGORY_URL_RE)].map((m) => m[1]))]

  const productUrls = new Set<string>()
  for (const categoryUrl of categoryUrls) {
    for (let page = 1; page <= MAX_CATEGORY_PAGES; page++) {
      let html: string
      try {
        html = await fetchText(categoryUrl + (page > 1 ? `?page=${page}` : ""))
      } catch {
        break
      }
      const before = productUrls.size
      for (const match of html.matchAll(PRODUCT_URL_RE)) productUrls.add(match[0])
      if (productUrls.size === before) break // no new products on this page -> stop paginating
    }
  }
  return [...productUrls]
}

export const atelierScammitAdapter: DesignerAdapter = {
  slug: "atelier-scammit",
  label: "Atelier Scammit",
  matchHosts: ["atelier-scammit.com", "www.atelier-scammit.com"],

  // Reconcile on the permanent PrestaShop product id, not the full URL: the
  // same product can be reached under several category paths
  // (/women/124-declic.html vs /free-patterns/124-declic.html) and can be
  // recategorised over time, but the numeric id never changes.
  identityKey(url) {
    return scammitProductId(url ?? "")
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const productUrls = await discoverProductUrls()
    const pages = await mapWithConcurrency(productUrls, CONCURRENCY, async (url) => ({
      url,
      html: await fetchText(url),
    }))
    return pages.map(parseProductPage).filter((p): p is ScrapedPattern => p !== null)
  },
}
