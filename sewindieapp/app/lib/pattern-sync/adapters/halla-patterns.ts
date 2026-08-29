import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Halla Patterns
// ---------------------------------------------------------------------------
// A Scandinavian indie label ("hallå") on Shopify. Fresh backfill (0 existing
// rows). Three decisions define this adapter.
//
//  1. PATTERNS ARE FOUND BY product_type = AUDIENCE. Every product is typed by
//     who it is for: "women" (30), "kids" (12), "baby" (2), plus one "Gift
//     Card". Keeping {women, kids, baby} yields 44 pattern products; the gift
//     card is the only exclusion. The vendor is "hallå" throughout.
//
//  2. "... for women" / "... for kids" STAY SEPARATE. Several designs exist in
//     both an adult and a child version -- "twirly skirt for women" and
//     "twirly skirt for kids" -- but these are DISTINCT products with distinct
//     handles and separately drafted, separately sold pattern pieces (not one
//     design in extended sizes, which is why they are NOT collapsed the way
//     Grainline's graded size ranges are). Each remains its own row, keyed on
//     its handle via the default URL identity.
//
//  3. NAMES ARE TITLE-CASED. The store writes every title in lowercase
//     ("rachael top & dress for women"). Because the names contain personal
//     nouns (Rachael, Hollie, Vivianne) that read as broken when left
//     lowercase, each word's first letter is upper-cased for display. Real
//     release dates (published_at) are spread across distinct dates and kept.
// ---------------------------------------------------------------------------

const STORE = "https://www.hallapatterns.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type audiences that are patterns (see decision 1).
const PATTERN_TYPES = new Set(["women", "kids", "baby", "men"])

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

// Upper-case the first letter of each whitespace-separated word, leaving the
// rest untouched so "&" and existing letters survive (see decision 3).
// Exported for the verify script's offline unit tests.
export function titleCase(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Halla Patterns returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    const type = (product.product_type ?? "").trim().toLowerCase()
    if (!PATTERN_TYPES.has(type)) continue

    const rawTitle = (product.title ?? "").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const name = titleCase(rawTitle)
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

export const hallaPatternsAdapter: DesignerAdapter = {
  slug: "halla-patterns",
  label: "Halla Patterns",
  matchHosts: ["hallapatterns.com", "www.hallapatterns.com"],

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
