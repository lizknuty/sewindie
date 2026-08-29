import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Emporia (emporia-fabric.co.uk)
// ---------------------------------------------------------------------------
// A UK fabric shop on Shopify that also publishes its own "Emporia Patterns"
// line. No existing rows -- a fresh backfill. Four decisions:
//
//  1. PATTERNS ARE THE "Sewing Patterns" PRODUCT_TYPE. Unlike Jupe/Brunette,
//     Emporia sets product_type cleanly: 27 products are "Sewing Patterns" and
//     the cross-checking tags ("sewing pattern"/"emporia pattern", both 27)
//     agree exactly. Everything else is fabric, thread, labels, or finished
//     "Sample ..." garments (product_type "dress"/"top"/"skirt" -- sample-sale
//     stock, NOT patterns), so the type filter is exact with zero tag-only
//     extras.
//
//  2. COLLAPSE PAPER + PDF BY HANDLE, PDF PREFERRED. 9 of the 18 designs are
//     sold as both a printed and a PDF listing. The DISPLAY TITLES are an
//     unreliable collapse key here -- the same design is titled inconsistently
//     ("... Frida Dress and Top PDF Pattern" vs "... Frida Dress Pattern") -- so
//     designs are grouped on a normalised HANDLE instead (strip the
//     "emporia[-patterns]-" prefix and the "[-pdf]-pattern[-pdf]" suffix), which
//     aligns all 9 pairs correctly. The PDF listing is canonical.
//
//  3. TITLES DROP THE REDUNDANT BRAND PREFIX AND FORMAT WORDS. Every title
//     starts "Emporia Patterns " (redundant under the Emporia designer) and ends
//     "PDF Pattern"/"Pattern". Both are stripped, leaving the garment name only
//     ("Valentina Dress", "Frida Dress and Top"), casing preserved.
//
//  4. RELEASE DATE IS NULL. published_at clusters on store-launch/migration
//     dates (7 of 27 on 2022-06-22), so it is a publish-to-store timestamp, not
//     a design release date, and is dropped.
// ---------------------------------------------------------------------------

const STORE = "https://emporia-fabric.co.uk"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

const PATTERN_TYPE = "sewing patterns"
const BUNDLE_TITLE = /\bbundles?\b/i
// A handle is a PDF listing when it carries the "pdf" token (either
// "...-pdf-pattern" or "...-pattern-pdf").
const PDF_HANDLE = /(^|-)pdf(-|$)/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  images?: Array<{ src?: string }>
}

export type PatternProduct = {
  designKey: string // normalised handle, the collapse key
  display: string // cleaned garment name
  format: "pdf" | "paper"
  handle: string
  imageUrl: string | null
  sourceId: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(display: string): ProductKind {
  return BUNDLE_TITLE.test(display) ? "bundle" : "pattern"
}

// Normalise a handle to a design key by removing the brand prefix and the
// format/pattern suffix. Exported for the verify script's offline unit tests.
export function designKeyFromHandle(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/^emporia-(patterns-)?/, "")
    .replace(/-?(pdf-)?pattern(-pdf)?$/, "")
    .replace(/-+$/, "")
}

// Strip the redundant "Emporia Patterns " brand prefix and trailing format words
// from a title. Exported for the verify script's offline unit tests.
export function cleanTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^emporia\s+patterns\s+/i, "")
    .replace(/\s*(pdf\s+)?pattern\s*$/i, "")
    .trim()
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Emporia returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Keep only "Sewing Patterns" products, decoding each one's design key, display
// name and format. Exported for the verify script's offline unit tests.
export function extractPatternProducts(products: ShopifyProduct[]): PatternProduct[] {
  const out: PatternProduct[] = []
  for (const product of products) {
    if ((product.product_type ?? "").trim().toLowerCase() !== PATTERN_TYPE) continue
    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    out.push({
      designKey: designKeyFromHandle(handle),
      display: cleanTitle(rawTitle),
      format: PDF_HANDLE.test(handle) ? "pdf" : "paper",
      handle,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      sourceId: String(product.id ?? handle),
    })
  }
  return out
}

// Collapse paper+PDF listings to one pattern per design (by handle key), PDF
// preferred. Exported for the verify script's offline unit tests.
export function collapseByDesign(patternProducts: PatternProduct[]): ScrapedPattern[] {
  const groups = new Map<string, { pdf?: PatternProduct; paper?: PatternProduct }>()
  for (const p of patternProducts) {
    const group = groups.get(p.designKey) ?? {}
    if (p.format === "pdf") group.pdf ??= p
    else group.paper ??= p
    groups.set(p.designKey, group)
  }

  const results: ScrapedPattern[] = []
  for (const group of groups.values()) {
    const canonical = group.pdf ?? group.paper
    if (!canonical) continue
    results.push({
      name: canonical.display,
      url: `${STORE}${PRODUCTS_PATH}${canonical.handle}`,
      imageUrl: canonical.imageUrl,
      releaseDate: null, // Shopify launch/migration timestamps -- see decision 4
      kind: classify(canonical.display),
      sourceId: canonical.sourceId,
    })
  }
  return results
}

export const emporiaAdapter: DesignerAdapter = {
  slug: "emporia",
  label: "Emporia",
  matchHosts: ["emporia-fabric.co.uk", "www.emporia-fabric.co.uk"],

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
