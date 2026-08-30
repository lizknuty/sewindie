import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Forget-me-not Patterns
// ---------------------------------------------------------------------------
// Small indie pattern house on Shopify. Fresh backfill (0 existing rows). The
// whole store is patterns -- every one of the 20 products has an empty
// product_type and the single "Forget-me-not Patterns" vendor, with no fabric,
// notions or gift cards mixed in. So there is no product_type/vendor filtering
// to do; every product is a pattern.
//
//  1. NAME = TITLE WITHOUT THE FORMAT PARENTHETICAL. Titles follow
//     "<Name> - <Garment> (<format> pattern)", e.g.
//     "Clementine - Knit dress and top (PDF pattern)",
//     "Vera - Knit top (Free PDF pattern)",
//     "Rosalie Skirt Expansion - Darted pattern pieces (Pay-what-you-can PDF Pattern)".
//     The trailing "(... pattern)" parenthetical is a delivery/pricing tag, not
//     part of the design name, so it is stripped. Each product is a distinct
//     design (no format pairs), so there is NO collapsing.
//
//  2. EXPANSIONS ARE KEPT AS PATTERNS. Three "... Expansion" products are
//     add-on pattern pieces -- still patterns (they contain graded pattern
//     pieces), so they are kept with kind "pattern".
//
//  3. RELEASE DATE KEPT. published_at values track the real release history.
// ---------------------------------------------------------------------------

const STORE = "https://forgetmenotpatterns.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Trailing "(... pattern)" delivery/pricing tag, e.g. "(PDF pattern)",
// "(Free PDF pattern)", "(Pay-what-you-can PDF Pattern)".
const FORMAT_PARENTHETICAL = /\s*\(([^)]*\bpattern\b[^)]*)\)\s*$/i

const GIFT_CARD_TITLE = /\bgift\s*card\b/i
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

// Strip the trailing "(... pattern)" parenthetical from a title.
// Exported for the verify script's offline unit tests.
export function cleanName(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .replace(FORMAT_PARENTHETICAL, "")
    .trim()
}

function classify(title: string): ProductKind {
  if (GIFT_CARD_TITLE.test(title)) return "other"
  if (BUNDLE_TITLE.test(title)) return "bundle"
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Forget-me-not Patterns returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Turn the raw feed into scraped patterns. Exported for unit tests.
export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const name = cleanName(rawTitle)
    if (!name) continue

    out.push({
      name,
      url: `${STORE}${PRODUCTS_PATH}${handle}`,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      releaseDate: product.published_at ?? null,
      kind: classify(rawTitle),
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

export const forgetMeNotPatternsAdapter: DesignerAdapter = {
  slug: "forget-me-not-patterns",
  label: "Forget-me-not Patterns",
  matchHosts: ["forgetmenotpatterns.com", "www.forgetmenotpatterns.com"],

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
