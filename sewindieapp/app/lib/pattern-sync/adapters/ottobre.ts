import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Ottobre Design
// ---------------------------------------------------------------------------
// A Finnish sewing-MAGAZINE publisher on Shopify -- the second fresh backfill
// (no existing rows to reconcile against), and an unusual one because most of
// what the store sells is not an individual pattern. The full products.json
// feed has ~224 products: 139 print "Magazine" issues, 3 "E-magazine" issues,
// 7 "E-pattern" downloads, and ~75 knitting-yarn / other-vendor products.
//
// Three decisions define this adapter.
//
//  1. ONLY THE 7 STANDALONE E-PATTERNS ARE STORED. The 139 print magazines and
//     3 e-magazines leak through products.json but are NOT live on the
//     storefront: their /products/<handle> pages 302-redirect to the homepage,
//     they are absent from sitemap.xml, the /collections/sewing-magazines page
//     renders empty, and the store's own search returns zero magazine hits.
//     Storing them would mean 142 patterns whose links bounce to the homepage,
//     so they are excluded until Ottobre publishes them to the online store.
//     A pattern here is a product with product_type === "E-pattern" and vendor
//     "OTTOBRE design(R)" -- the vendor guard drops the Katia/Gedifra yarn.
//     All 7 e-patterns return 200 and carry an image. (Some are knitting
//     patterns -- mittens, beanie -- which is fine: the owner chose "every
//     e-pattern", not "sewing e-patterns only".)
//
//  2. TITLES DROP THE "E-PATTERN" SUFFIX, CASING PRESERVED. Titles carry an
//     inconsistent trailing marker -- "RACHEL knit dress, e-pattern",
//     "Merino Wool Beanie e-pattern", "Girls' panties and boyshorts e-pattern"
//     -- with the comma sometimes present, sometimes not. That suffix (and any
//     leading comma) is stripped so stored names are the design only. The
//     shouty product-name caps ("RACHEL", "PAPU", "ARCTIC WINTER") are Ottobre's
//     deliberate house style, NOT title-casing damage, so they are preserved
//     exactly as written.
//
//  3. URL IS THE BARE /products/<handle>, RELEASE DATE IS NULL. All 7 e-pattern
//     handles resolve 200 at the bare product path. published_at is a Shopify
//     migration timestamp -- 6 of the 7 share 2025-04-08, equal to created_at --
//     not a real release date, so it is dropped.
// ---------------------------------------------------------------------------

const STORE = "https://www.ottobredesign.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// ~224 products = 1 page today; 20 leaves generous headroom while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Decision 1: the only product_type we keep, and the only vendor we trust.
const PATTERN_PRODUCT_TYPE = "e-pattern"
const OTTOBRE_VENDOR = /ottobre/i

// Decision 2: trailing ", e-pattern" / " e-pattern" marker (comma optional,
// hyphen or space before "pattern"), case-insensitive.
const EPATTERN_SUFFIX = /\s*,?\s*e[-\s]?pattern\s*$/i

// Bundle safety net -- none of the 7 e-patterns is a bundle today, but a future
// "... Bundle e-pattern" should be flagged rather than posing as a plain pattern.
const BUNDLE_TITLE = /\bbundles?\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  vendor?: string
  product_type?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(name: string): ProductKind {
  return BUNDLE_TITLE.test(name) ? "bundle" : "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Ottobre returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Keep only OTTOBRE-published e-patterns, strip the suffix, and map to the
// shared shape. See decisions 1-3. Exported for the verify script's offline
// unit tests.
export function extractEPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []

  for (const product of products) {
    const productType = (product.product_type ?? "").trim().toLowerCase()
    if (productType !== PATTERN_PRODUCT_TYPE) continue
    if (!OTTOBRE_VENDOR.test(product.vendor ?? "")) continue

    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const name = rawTitle.replace(EPATTERN_SUFFIX, "").trim()
    if (!name) continue

    out.push({
      name,
      url: `${STORE}${PRODUCTS_PATH}${handle}`,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      releaseDate: null, // Shopify migration timestamp, not a release date -- see decision 3
      kind: classify(name),
      sourceId: String(product.id ?? handle),
    })
  }

  return out
}

export const ottobreAdapter: DesignerAdapter = {
  slug: "ottobre",
  label: "Ottobre Design",
  matchHosts: ["ottobredesign.com", "www.ottobredesign.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    return extractEPatterns(products)
  },
}
