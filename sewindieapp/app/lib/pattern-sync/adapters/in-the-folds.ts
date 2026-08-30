import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// In the Folds
// ---------------------------------------------------------------------------
// The public site (inthefolds.com) is a Squarespace CONTENT/blog site, but the
// actual STORE is a separate Shopify shop at shop.inthefolds.com -- so this is
// a Shopify adapter pointed at that subdomain. Fresh backfill.
//
// The 51-product catalogue mixes standalone garment patterns with a large body
// of learning "Resources" (skills kits, fit kits, hack kits, sewing series,
// journals, planners) plus a gift card. Classification:
//
//  - product_type "Resources" or "Gift Cards"  -> kind "other" (support
//    material and store credit; kept for admin review, not treated as a
//    standalone pattern).
//  - title contains "Bundle"                    -> kind "bundle" (e.g. "Neale
//    Jumpsuit Bundle", "Acton Dress Bundle (Pattern + Sleeve Hack Expansion)").
//  - title reads as a kit/series/hack/expansion/journal/planner/course
//                                               -> kind "other" (catches the
//    garment-TYPED support items such as "Acton Dress Hack (Sleeve Expansion)"
//    and "Barkly skirt Hack Kit" that would otherwise look like patterns).
//  - everything else (garment product_types)    -> kind "pattern".
//
// Names are kept verbatim (clean, e.g. "Rushcutter dress", "Darlow pants").
// Real published_at dates are kept.
// ---------------------------------------------------------------------------

const STORE = "https://shop.inthefolds.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_types that are never standalone patterns.
const OTHER_TYPES = new Set(["resources", "gift cards", "gift card"])

const BUNDLE_TITLE = /\bbundles?\b/i
// Support-material signals in the title (not a standalone pattern).
const SUPPORT_TITLE = /\b(?:kit|series|journal|planner|expansion|hack|course|introduction)\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Exported for the verify script's offline unit tests.
export function classify(productType: string, title: string): ProductKind {
  if (OTHER_TYPES.has(productType.trim().toLowerCase())) return "other"
  if (BUNDLE_TITLE.test(title)) return "bundle"
  if (SUPPORT_TITLE.test(title)) return "other"
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`In the Folds returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    const rawTitle = (product.title ?? "").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const name = rawTitle.replace(/\s+/g, " ").trim()
    out.push({
      name,
      url: `${STORE}${PRODUCTS_PATH}${handle}`,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      releaseDate: product.published_at ?? null,
      kind: classify(product.product_type ?? "", name),
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

export const inTheFoldsAdapter: DesignerAdapter = {
  slug: "in-the-folds",
  label: "In the Folds",
  // The designer record's URL is the content site (inthefolds.com), but every
  // pattern lives on the Shopify store subdomain. List both so the adapter
  // resolves from the designer URL, and set importHosts so the import route
  // accepts the shop.inthefolds.com product URLs (same cross-host case as Mood).
  matchHosts: ["inthefolds.com", "www.inthefolds.com", "shop.inthefolds.com"],
  importHosts: ["shop.inthefolds.com", "inthefolds.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }
    return toPatterns(products)
  },
}
