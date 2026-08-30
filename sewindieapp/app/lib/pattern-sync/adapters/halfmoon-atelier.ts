import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Halfmoon Atelier
// ---------------------------------------------------------------------------
// A small indie label on Shopify. Fresh backfill (0 existing rows).
//
//  1. PATTERNS ARE FOUND BY product_type = "sewing pattern". The 14-product
//     shop is 13 patterns plus one "Ceramic Mug" (empty product_type), so
//     filtering to product_type "sewing pattern" cleanly keeps exactly the
//     patterns and drops the merch.
//
//  2. NAMES: titles are styled "<descriptor> NAME | PDF sewing pattern" with
//     the design name in CAPS ("STRAND dress + top | PDF sewing pattern",
//     "boat neck ANEGADA | PDF sewing pattern"). `cleanName` drops the
//     " | ... pattern" format tail and keeps the descriptive design name as
//     written (mixed case preserved -- the caps are the brand's styling, and
//     de-shouting "ANEGADA" would fight the house look; left verbatim).
//
//  3. BUNDLES: a few products are multi-pattern bundles ("WELL'S + TOFO ...
//     bundle", "ANEGADA + DELPY + ROMA pattern bundle") -> flagged
//     kind:"bundle" (kept, not dropped). Real published_at dates are kept.
// ---------------------------------------------------------------------------

const STORE = "https://www.halfmoonatelier.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

const PATTERN_TYPE = "sewing pattern"
const BUNDLE_TITLE = /\bbundle\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Drop the " | PDF sewing pattern" (or "| PDF pattern") format tail; keep the
// design name as written. Exported for the verify script's offline unit tests.
export function cleanName(rawTitle: string): string {
  let name = rawTitle.replace(/\s+/g, " ").trim()
  const barIdx = name.indexOf("|")
  if (barIdx !== -1) name = name.slice(0, barIdx).trim()
  return name.replace(/\s+/g, " ").trim()
}

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
  if (!res.ok) throw new Error(`Halfmoon Atelier returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    const type = (product.product_type ?? "").trim().toLowerCase()
    if (type !== PATTERN_TYPE) continue

    const rawTitle = (product.title ?? "").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const name = cleanName(rawTitle)
    if (!name) continue
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

export const halfmoonAtelierAdapter: DesignerAdapter = {
  slug: "halfmoon-atelier",
  label: "Halfmoon Atelier",
  matchHosts: ["halfmoonatelier.com", "www.halfmoonatelier.com"],

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
