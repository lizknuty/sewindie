import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Grainline Studio
// ---------------------------------------------------------------------------
// A well-known US indie pattern house on Shopify. Fresh backfill (0 existing
// rows). The store mixes patterns with sewing supplies, so three decisions
// define this adapter.
//
//  1. PATTERNS ARE FOUND BY product_type. Every product carries a real
//     product_type: "Pattern" (55), "Free" (12, the free patterns -- still
//     patterns), "Supply" (10, notions/tools -- excluded), "Gift Card" (1) and
//     one empty. Keeping {Pattern, Free} yields 67 pattern products with no
//     fabric/notion noise. The single Grainline vendor confirms there are no
//     third-party resells to worry about.
//
//  2. SIZE-RANGE PAIRS COLLAPSE TO ONE DESIGN. Most patterns are sold as two
//     separate products, one per extended size range -- "Poppy Dress 0–18" and
//     "Poppy Dress 14–32". These are the SAME garment design in different
//     graded sizes, so they collapse to a single row keyed on the title with
//     the trailing size range stripped. 50 of 67 products carry a size suffix,
//     collapsing the catalogue to 49 designs. Products with no size suffix
//     (bags, accessories) are one design each. The canonical product (handle,
//     URL, image, id) is the first-seen of a pair; the stored name has the size
//     range removed.
//
//  3. RELEASE DATE KEPT. Unlike the batch-migrated Shopify stores, Grainline's
//     published_at values are spread across many distinct dates that track the
//     real release history, so they are preserved.
// ---------------------------------------------------------------------------

const STORE = "https://grainlinestudio.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type values that are patterns (see decision 1).
const PATTERN_TYPES = new Set(["pattern", "free"])

// Trailing extended-size range, e.g. " 0-18", " 14–32" (hyphen or en-dash).
const SIZE_RANGE_SUFFIX = /\s+\d{1,2}\s*[-–]\s*\d{1,2}\s*$/

const BUNDLE_TITLE = /\bbundles?\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

export type PatternProduct = {
  design: string // size-range-stripped garment name, casing preserved
  handle: string
  imageUrl: string | null
  publishedAt: string | null
  sourceId: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(design: string): ProductKind {
  return BUNDLE_TITLE.test(design) ? "bundle" : "pattern"
}

// Strip a trailing extended-size range so the two graded listings of a design
// share one key. Exported for the verify script's offline unit tests.
export function designStem(title: string): string {
  return title.replace(SIZE_RANGE_SUFFIX, "").trim()
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Grainline Studio returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Keep only pattern products and decode each one's design stem.
// Exported for the verify script's offline unit tests.
export function extractPatternProducts(products: ShopifyProduct[]): PatternProduct[] {
  const out: PatternProduct[] = []
  for (const product of products) {
    const type = (product.product_type ?? "").trim().toLowerCase()
    if (!PATTERN_TYPES.has(type)) continue

    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const design = designStem(rawTitle)
    if (!design) continue

    out.push({
      design,
      handle,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      publishedAt: product.published_at ?? null,
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

// Collapse size-range pairs to one canonical pattern per design (decision 2).
// Exported for the verify script's offline unit tests.
export function collapseByDesign(patternProducts: PatternProduct[]): ScrapedPattern[] {
  const groups = new Map<string, PatternProduct>()
  for (const p of patternProducts) {
    const key = p.design.toLowerCase()
    // First-seen listing wins as canonical; the store lists both graded sizes
    // with identical imagery, so either is fine.
    if (!groups.has(key)) groups.set(key, p)
  }

  const results: ScrapedPattern[] = []
  for (const canonical of groups.values()) {
    results.push({
      name: canonical.design,
      url: `${STORE}${PRODUCTS_PATH}${canonical.handle}`,
      imageUrl: canonical.imageUrl,
      releaseDate: canonical.publishedAt, // real release history -- see decision 3
      kind: classify(canonical.design),
      sourceId: canonical.sourceId,
    })
  }
  return results
}

export const grainlineStudioAdapter: DesignerAdapter = {
  slug: "grainline-studio",
  label: "Grainline Studio",
  matchHosts: ["grainlinestudio.com", "www.grainlinestudio.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }
    return collapseByDesign(extractPatternProducts(products))
  },
}
