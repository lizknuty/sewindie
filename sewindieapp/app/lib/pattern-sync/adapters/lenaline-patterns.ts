import type { DesignerAdapter, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Lenaline Patterns
// ---------------------------------------------------------------------------
// A WooCommerce store, multilingual via WPML. The English catalogue is served
// under the `/en/` path prefix through the WC Store API (public, no auth):
//   /en/wp-json/wc/store/v1/products?per_page=100&page=N
// Products carry: id, name, permalink, date_created, images[].src, categories.
//
// Two filters:
//  1. PATTERNS ONLY. The store also sells hardware/notions; the sewing patterns
//     are the products in the "Lenaline Patterns" category. We keep a product
//     only if one of its categories matches that name.
//  2. DROP WPML DRAFT COPIES. WooCommerce/WPML leaves duplicate draft products
//     named "... (Copy)" / "... (Copie)" in the feed; those are filtered out.
//
// English names come through the /en feed already ("Luca top", "Zoya dress");
// a few keep French names ("Jupe Lola") where no translation was set -- kept
// as-is. Identity is the product id. date_created is a real release date, kept.
// ---------------------------------------------------------------------------

const BASE = "https://lenaline.com/en"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const PER_PAGE = 100
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

const PATTERN_CATEGORY = /lenaline\s+patterns/i
const DRAFT_COPY = /\((?:copy|copie)\)/i

type WooProduct = {
  id: number
  name?: string
  permalink?: string
  date_created?: string
  images?: Array<{ src?: string }>
  categories?: Array<{ name?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
}

async function fetchPage(page: number): Promise<WooProduct[]> {
  const url = `${BASE}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Lenaline returned ${res.status} for ${url}`)
  const body = (await res.json()) as unknown
  return Array.isArray(body) ? (body as WooProduct[]) : []
}

export const lenalinePatternsAdapter: DesignerAdapter = {
  slug: "lenaline-patterns",
  label: "Lenaline Patterns",
  matchHosts: ["lenaline.com", "www.lenaline.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: WooProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      const inPatternCategory = (product.categories ?? []).some((c) => PATTERN_CATEGORY.test(c.name ?? ""))
      if (!inPatternCategory) continue

      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name || DRAFT_COPY.test(name)) continue // skip WPML draft copies

      const url = (product.permalink ?? "").trim()
      if (!url || seen.has(url)) continue
      seen.add(url)

      results.push({
        name,
        url,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }
    return results
  },
}
