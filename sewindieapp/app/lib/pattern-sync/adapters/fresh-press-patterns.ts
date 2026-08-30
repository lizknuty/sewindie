import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Fresh Press Patterns
// ---------------------------------------------------------------------------
// A small indie label on Shopify. Fresh backfill (0 existing rows). The shop is
// tiny (~20 products) and mixes a handful of sewing patterns with deadstock
// fabric remnants, so the filter is the whole story here.
//
//  1. PATTERNS ARE THE GARMENT-TYPED PRODUCTS. The 9 patterns each carry a real
//     garment product_type -- "Dress", "Tops", "Cami", "coat", "Pants". The
//     fabric ("ROLLS END ... Jersey", "Deadstock Print Jersey", "French
//     Brocade") all has an EMPTY product_type, and the only other non-empty
//     type is "Gift Card". So: keep products whose product_type is set and is
//     not "Gift Card"; everything with an empty type (all fabric) and the gift
//     card drop out. This cleanly yields the 9 patterns with no fabric noise.
//     (Their tags -- "... sewing pattern", "PDF sewing pattern" -- corroborate,
//     but product_type alone is unambiguous.)
//
//  2. NO FORMAT/SIZE COLLAPSE. Each design is a single product (no paper/PDF
//     duplication, no per-size listings), so titles and identity are 1:1.
//
//  3. RELEASE DATE KEPT. published_at values are spread across distinct dates,
//     so they are preserved as the release history.
// ---------------------------------------------------------------------------

const STORE = "https://freshpresspatterns.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_types that are NOT patterns. Fabric has an empty type (handled
// separately); this covers the non-empty non-garment types.
const NON_PATTERN_TYPES = new Set(["gift card", "gift cards"])

const BUNDLE_TITLE = /\bbundles?\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(name: string): ProductKind {
  return BUNDLE_TITLE.test(name) ? "bundle" : "pattern"
}

// A product is a pattern when it has a non-empty product_type that is not a
// gift card (see decision 1). Exported for the verify script's unit tests.
export function isPattern(product: ShopifyProduct): boolean {
  const type = (product.product_type ?? "").trim().toLowerCase()
  if (!type) return false // fabric
  return !NON_PATTERN_TYPES.has(type)
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Fresh Press Patterns returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    if (!isPattern(product)) continue
    const name = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!name || !handle) continue

    out.push({
      name,
      url: `${STORE}${PRODUCTS_PATH}${handle}`,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      releaseDate: product.published_at ?? null,
      kind: classify(name),
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

export const freshPressPatternsAdapter: DesignerAdapter = {
  slug: "fresh-press-patterns",
  label: "Fresh Press Patterns",
  matchHosts: ["freshpresspatterns.com", "www.freshpresspatterns.com"],

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
