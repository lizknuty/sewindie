import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Greenstyle Creations runs on Shopify, so the public `/products.json` feed
// works the same way it does for Jalie. No auth, no HTML scraping.
//
// Verified shape (517 products, 216 of type "Sewing Pattern", 3 pages at 250):
//   products[].title        -> "Monaco Tank PDF Sewing Pattern"
//   products[].handle       -> slug for the product URL
//   products[].images[0].src-> image URL
//   products[].published_at -> release date (95 distinct days, so trustworthy)
//   products[].product_type -> "Sewing Pattern" | "Fabric" | "Kit" | ...
//
// Two wrinkles specific to this designer:
//
//  1. Domain. The catalogue records the designer as greenstylecreations.com,
//     which now 301s to greenstyle.com. Both hosts are declared so the registry
//     still matches the designer record *and* the import route accepts the
//     greenstyle.com product URLs already used by the 182 existing rows.
//
//  2. Naming. Unlike Jalie, the store titles here need no cleanup: they are
//     already mixed-case and match the verbose convention of the existing
//     catalogue rows ("Azure Top and Dress PDF Sewing Pattern"). They are
//     stored verbatim -- deliberately not title-cased, because doing so is what
//     turned "PDF" into "Pdf" on the rows imported before this feature existed.

const STORE = "https://greenstyle.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// 3 pages covers the current catalogue; 10 leaves room to grow while making a
// pagination bug upstream impossible to turn into an infinite loop.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

/** Shopify product_type for real sewing patterns; everything else is merch. */
const PATTERN_PRODUCT_TYPE = "sewing pattern"

/**
 * Listings the store files under "Sewing Pattern" that aren't patterns: a
 * coloring book, and a single optional pattern piece sold as an extra. Matched
 * on distinctive words rather than the full title so a punctuation tweak
 * upstream doesn't silently un-flag them.
 */
const NOT_A_PATTERN = [/\bcoloring book\b/i, /\bgusset\b/i]

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string | null
  tags?: string[]
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Letters and digits only, lowercased -- so "Add-On" keys as "addon". */
const keyOf = (value: string) => value.replace(/[^\p{L}\d]/gu, "").toLowerCase()

/**
 * Classifies a listing. Tags are consulted first (the store's own answer) and
 * title text second, since tagging is inconsistent on older listings.
 */
function classify(product: ShopifyProduct, title: string): ProductKind {
  if (NOT_A_PATTERN.some((pattern) => pattern.test(title))) return "other"

  const tags = product.tags ?? []
  const taggedAddon = tags.some((tag) => keyOf(tag).includes("addon"))
  if (taggedAddon || /\badd-?ons?\b/i.test(title) || /\bexpansion\b/i.test(title)) return "addon"

  const taggedBundle = tags.some((tag) => keyOf(tag).includes("bundle"))
  if (taggedBundle || /\bbundle\b/i.test(title)) return "bundle"

  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Greenstyle returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const greenstyleCreationsAdapter: DesignerAdapter = {
  slug: "greenstyle-creations",
  label: "Greenstyle Creations",
  // greenstylecreations.com matches the designer record; greenstyle.com is
  // where products actually live after the redirect. Both are required.
  matchHosts: ["greenstylecreations.com", "www.greenstylecreations.com", "greenstyle.com", "www.greenstyle.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    // Trust the store's own product_type to separate patterns from fabric and
    // kits -- but if nothing matches (a renamed type upstream), keep everything
    // rather than silently reporting an empty catalogue.
    const patternsOnly = products.filter((p) => (p.product_type ?? "").trim().toLowerCase() === PATTERN_PRODUCT_TYPE)
    const candidates = patternsOnly.length > 0 ? patternsOnly : products

    const results: ScrapedPattern[] = []

    for (const product of candidates) {
      // Store titles are already correctly cased, so they are kept verbatim.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(product, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
