import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Atelier Brunette
// ---------------------------------------------------------------------------
// A French fabric house on Shopify, and the first adapter built for a designer
// with NO existing rows in the database -- this is a fresh backfill, not a
// reconciliation, so there was no stored convention to match. The decisions
// below were made from scratch (with the site owner) and are the convention.
//
// The store is fabric-first: of ~1,294 products, product_type is empty on 1,291
// of them, so that field is useless here. Patterns are a tiny, well-marked
// subset. Four decisions define this adapter.
//
//  1. PATTERNS ARE FOUND BY THE ENGLISH TITLE SUFFIX. Every sewing pattern's
//     English title ends "- PDF Sewing Pattern" or "- Paper Sewing Pattern"
//     (casing varies: "...Sewing Pattern" vs "...sewing pattern"). That suffix
//     matches 94 products with ZERO false positives, and cross-validates almost
//     exactly against the Shopify tag `collection-de-patrons-a-coudre` (97):
//     the 3 tag-only extras are correctly NOT patterns -- a "THE Pattern
//     Collection" landing page, a free "Sewing Hack", and a "PDF Knitting Kit".
//     Fabric noise ("Milward Gridded Pattern Paper", "Braided Pattern" raffia)
//     is naturally excluded because it does not carry the suffix. The suffix is
//     chosen over the tag because it also tells us the FORMAT, which decision 2
//     needs. Titles are read from the /en/ locale feed so the suffix is English.
//
//  2. PAPER + PDF COLLAPSE TO ONE PATTERN PER DESIGN, PDF PREFERRED. 43 of the
//     51 designs are sold twice -- once as a printed pattern, once as a PDF --
//     as two separate products. A pattern in SewIndie is a garment design, not
//     a format SKU, so the two are collapsed into a single row keyed on the
//     design name (the title with the suffix stripped, lower-cased). The PDF
//     product is canonical (its handle, URL and image win); when a design has
//     no PDF the paper product is used. The catalogue is unambiguous here:
//     no design has more than one PDF or more than one paper listing, 7 designs
//     are PDF-only and exactly 1 ("LA COMBI ADDIE") is paper-only. Result: 51
//     patterns from 94 products.
//
//  3. TITLES DROP THE FORMAT SUFFIX, CASING PRESERVED. Stored titles are the
//     garment name only -- "LE Sweat", "LA Robe Butterfly" -- with the
//     "- PDF/Paper Sewing Pattern" suffix removed and whitespace collapsed. The
//     shouty French articles ("LE", "LA", "L'") are the brand's deliberate house
//     style, NOT title-casing damage, so they are left exactly as the store
//     writes them.
//
//  4. URL IS THE BARE /products/<handle>, RELEASE DATE IS NULL. Only the bare
//     `/products/<handle>` returns 200; the `/en/`, `/collections/all/` and
//     combined shapes all 302-redirect to it, so the bare form is the canonical
//     URL (even though the designer record itself is the `/en` homepage). And
//     the store was migrated onto Shopify in one batch -- 57 of 94 products
//     share the published_at date 2025-05-14, equal to their created_at -- so
//     published_at is a migration timestamp, not a release date, and is dropped.
// ---------------------------------------------------------------------------

const STORE = "https://www.atelierbrunette.com"
// Read English titles (the suffix in decision 1 is English) ...
const PRODUCTS_FEED = `${STORE}/en/products.json`
// ... but store the canonical bare product URL (decision 4).
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// ~1,294 products = 6 pages today; 20 leaves generous headroom while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// The pattern marker: an English title ending "- PDF/Paper [Sewing] Pattern".
// The capture group gives the format. Hyphen or en-dash, case-insensitive. See
// decisions 1 and 2.
const PATTERN_SUFFIX = /\s*[-–]\s*(pdf|paper)\s*(?:sewing\s*)?pattern\s*$/i

// Bundle safety net -- none of the 51 designs is a bundle today, but a future
// "... Bundle - PDF Sewing Pattern" should still be flagged rather than posing
// as a plain pattern.
const BUNDLE_TITLE = /\bbundles?\b/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  images?: Array<{ src?: string }>
}

export type PatternProduct = {
  design: string // suffix-stripped garment name, casing preserved
  format: "pdf" | "paper"
  handle: string
  imageUrl: string | null
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

  if (!res.ok) {
    throw new Error(`Atelier Brunette returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Pull the pattern products out of the full catalogue, decoding each one's
// design name and format. Everything without the pattern suffix (fabric, kits,
// haberdashery, landing pages) is dropped here -- see decision 1.
// Exported for the verify script's offline unit tests.
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
      sourceId: String(product.id ?? handle),
    })
  }

  return out
}

// Collapse paper+PDF pairs to one canonical pattern per design, PDF preferred.
// See decision 2. Exported for the verify script's offline unit tests.
export function collapseByDesign(patternProducts: PatternProduct[]): ScrapedPattern[] {
  // Group by the case-folded design name, preserving the first-seen casing.
  const groups = new Map<string, { display: string; pdf?: PatternProduct; paper?: PatternProduct }>()

  for (const p of patternProducts) {
    const key = p.design.toLowerCase()
    const group = groups.get(key) ?? { display: p.design }
    // Keep the first listing of each format (the catalogue never has two).
    if (p.format === "pdf") group.pdf ??= p
    else group.paper ??= p
    groups.set(key, group)
  }

  const results: ScrapedPattern[] = []
  for (const group of groups.values()) {
    const canonical = group.pdf ?? group.paper
    if (!canonical) continue // unreachable: every group has at least one format

    results.push({
      name: group.display,
      url: `${STORE}${PRODUCTS_PATH}${canonical.handle}`,
      imageUrl: canonical.imageUrl,
      releaseDate: null, // Shopify migration timestamps, not release dates -- see decision 4
      kind: classify(group.display),
      sourceId: canonical.sourceId,
    })
  }

  return results
}

export const atelierBrunetteAdapter: DesignerAdapter = {
  slug: "atelier-brunette",
  label: "Atelier Brunette",
  matchHosts: ["atelierbrunette.com", "www.atelierbrunette.com"],

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
