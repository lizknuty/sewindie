import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Atelier Jupe
// ---------------------------------------------------------------------------
// A Belgian pattern-and-fabric house on Shopify, no existing rows in the
// database -- a fresh backfill. The store is structurally identical to Atelier
// Brunette (see that adapter), so the same four decisions apply, with the
// concrete values tuned to Jupe's catalogue:
//
//  1. PATTERNS ARE FOUND BY THE ENGLISH TITLE SUFFIX. product_type is empty on
//     all 150 products and there are no tags, so those fields are useless. Every
//     sewing pattern's title ends "- PDF Pattern" or "- Paper Pattern" (no
//     "Sewing" word here, unlike Brunette; the regex allows it optionally). That
//     suffix matches 84 products with zero false positives -- everything else is
//     fabric ("Sample piece - ...", "Remnants - ...", "Coupon 90cm - ...").
//
//  2. PAPER + PDF COLLAPSE TO ONE PATTERN PER DESIGN, PDF PREFERRED. The 84
//     products are 46 designs, most sold as both a paper and a PDF listing. A
//     SewIndie pattern is a garment design, not a format SKU, so the two are
//     collapsed into one row keyed on the suffix-stripped design name. The PDF
//     listing is canonical (handle/URL/image win); paper-only designs fall back
//     to the paper listing.
//
//  3. TITLES DROP THE FORMAT SUFFIX, CASING PRESERVED. Stored names are the
//     garment name only, with the "- PDF/Paper Pattern" suffix removed and
//     whitespace collapsed. Casing (incl. the brand's "&") is left as written.
//
//  4. URL IS THE BARE /products/<handle>. That form returns 200. Unlike
//     Brunette, Jupe's pattern published_at dates are well distributed (20
//     distinct dates across 46 designs, max 8 on any day) rather than a single
//     migration batch, so they are kept as real release dates.
// ---------------------------------------------------------------------------

const STORE = "https://atelierjupe.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Title ending "- PDF/Paper [Sewing] Pattern"; capture group gives the format.
const PATTERN_SUFFIX = /\s*[-–]\s*(pdf|paper)\s*(?:sewing\s*)?pattern\s*$/i
const BUNDLE_TITLE = /\bbundles?\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

export type PatternProduct = {
  design: string
  format: "pdf" | "paper"
  handle: string
  imageUrl: string | null
  publishedAt: string | null
  sourceId: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(design: string): ProductKind {
  return BUNDLE_TITLE.test(design) ? "bundle" : "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Atelier Jupe returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Pull pattern products out of the full catalogue by the title suffix (decision
// 1). Exported for the verify script's offline unit tests.
export function extractPatternProducts(products: ShopifyProduct[]): PatternProduct[] {
  const out: PatternProduct[] = []
  for (const product of products) {
    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    const match = rawTitle.match(PATTERN_SUFFIX)
    if (!match) continue

    const design = rawTitle.replace(PATTERN_SUFFIX, "").trim()
    if (!design) continue

    out.push({
      design,
      format: match[1].toLowerCase() === "pdf" ? "pdf" : "paper",
      handle,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      publishedAt: product.published_at ?? null,
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

// Collapse paper+PDF pairs to one canonical pattern per design, PDF preferred
// (decision 2). Exported for the verify script's offline unit tests.
export function collapseByDesign(patternProducts: PatternProduct[]): ScrapedPattern[] {
  const groups = new Map<string, { display: string; pdf?: PatternProduct; paper?: PatternProduct }>()
  for (const p of patternProducts) {
    const key = p.design.toLowerCase()
    const group = groups.get(key) ?? { display: p.design }
    if (p.format === "pdf") group.pdf ??= p
    else group.paper ??= p
    groups.set(key, group)
  }

  const results: ScrapedPattern[] = []
  for (const group of groups.values()) {
    const canonical = group.pdf ?? group.paper
    if (!canonical) continue
    results.push({
      name: group.display,
      url: `${STORE}${PRODUCTS_PATH}${canonical.handle}`,
      imageUrl: canonical.imageUrl,
      // Shopify published_at is already an ISO 8601 string; pass it through.
      releaseDate: canonical.publishedAt ?? null,
      kind: classify(group.display),
      sourceId: canonical.sourceId,
    })
  }
  return results
}

export const atelierJupeAdapter: DesignerAdapter = {
  slug: "atelier-jupe",
  label: "Atelier Jupe",
  matchHosts: ["atelierjupe.com", "www.atelierjupe.com"],

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
