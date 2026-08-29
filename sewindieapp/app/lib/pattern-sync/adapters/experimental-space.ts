import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Experimental Space (experimentalspace.com)
// ---------------------------------------------------------------------------
// A WooCommerce shop, no existing rows -- a fresh backfill. Read from the public
// WooCommerce Store API (`/wp-json/wc/store/v1/products`), which returns the
// whole catalogue (32 products, one page) with names, images, permalinks and
// category terms. Four decisions:
//
//  1. SEWING PATTERNS ONLY -- KNITTING IS EXCLUDED. The shop sells both sewing
//     and knitting patterns. Categories are the reliable signal: a product is
//     kept only if it is in a sewing category ("Sewing Patterns"/"Paper
//     Patterns"/"PDF Patterns") AND NOT in "Knitting Patterns". That drops the 8
//     knitting designs (cardigans, sweaters, shawls) cleanly.
//
//  2. FORMAT VARIANTS COLLAPSE TO ONE PATTERN PER DESIGN, PDF PREFERRED. Every
//     design is sold in several formats as separate products -- "<Design> :
//     Sewing Pattern (PDF)", "... (Paper)", "... : Paper *LIMITED SIZES*", and
//     standalone "A0 Copyshop Print" listings. The design name is the part of
//     the title before the colon; products are grouped on it and the PDF listing
//     wins (then paper). This yields 6 patterns (Josie Blouse, Evelyn Blouse,
//     Rosalee Dress, Lily Top, Hailey Shirt, Casey Sweater) from 16 products.
//
//  3. COPYSHOP-ONLY LISTINGS ARE DROPPED. "A0 Copyshop Print" products sit in
//     the "Copyshop" category only (not a sewing-pattern category), so decision
//     1 already excludes them -- along with promo/combo oddments ("Slight
//     Misprint Sale ...", "Lily PDF + A0 Copyshop Print"). Every design they
//     cover still has a PDF/paper listing, so nothing is lost.
//
//  4. NAME IS THE DESIGN, DATE IS NULL. Stored name is the pre-colon design with
//     "*...*" annotations ("*LIMITED SIZES*", "*Original Sizes*") removed. The
//     Store API exposes no creation date and the catalogue is a single Feb-2023
//     launch batch, so releaseDate is null.
// ---------------------------------------------------------------------------

const STORE = "https://experimentalspace.com"
const PRODUCTS_API = `${STORE}/wp-json/wc/store/v1/products`

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

const SEWING_CATEGORIES = new Set(["sewing patterns", "paper patterns", "pdf patterns"])
const KNITTING_CATEGORY = "knitting patterns"
const BUNDLE_TITLE = /\bbundles?\b/i

export type WooProduct = {
  id?: number
  name?: string
  permalink?: string
  categories?: Array<{ name?: string }>
  images?: Array<{ src?: string }>
}

export type PatternProduct = {
  design: string
  format: "pdf" | "paper"
  permalink: string
  imageUrl: string | null
  sourceId: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(design: string): ProductKind {
  return BUNDLE_TITLE.test(design) ? "bundle" : "pattern"
}

// The design name is the title up to the first colon, with "*...*" annotations
// removed. Exported for the verify script's offline unit tests.
export function designName(rawName: string): string {
  return rawName
    .split(/\s*:\s*/)[0]
    .replace(/\*[^*]*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// A listing is PDF when its title says so; everything else (Paper, "Paper
// *LIMITED SIZES*") is treated as paper. Exported for unit tests.
export function detectFormat(rawName: string): "pdf" | "paper" {
  return /\(pdf\)|\bpdf\b/i.test(rawName) ? "pdf" : "paper"
}

function isSewingPattern(product: WooProduct): boolean {
  const cats = (product.categories ?? []).map((c) => (c.name ?? "").trim().toLowerCase())
  return cats.some((c) => SEWING_CATEGORIES.has(c)) && !cats.includes(KNITTING_CATEGORY)
}

// Pull the sewing-pattern products (decision 1) and decode each one's design +
// format. Exported for the verify script's offline unit tests.
export function extractPatternProducts(products: WooProduct[]): PatternProduct[] {
  const out: PatternProduct[] = []
  for (const product of products) {
    if (!isSewingPattern(product)) continue
    const rawName = (product.name ?? "").replace(/\s+/g, " ").trim()
    const permalink = (product.permalink ?? "").trim()
    const design = designName(rawName)
    if (!design || !permalink) continue

    out.push({
      design,
      format: detectFormat(rawName),
      permalink,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      sourceId: String(product.id ?? permalink),
    })
  }
  return out
}

// Collapse format variants to one pattern per design, PDF preferred (decision
// 2). Exported for the verify script's offline unit tests.
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
      url: canonical.permalink,
      imageUrl: canonical.imageUrl,
      releaseDate: null, // Store API exposes no date; single launch batch -- see decision 4
      kind: classify(group.display),
      sourceId: canonical.sourceId,
    })
  }
  return results
}

async function fetchPage(page: number): Promise<WooProduct[]> {
  const url = `${PRODUCTS_API}?per_page=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Experimental Space returned ${res.status} for ${url}`)
  const body = (await res.json()) as unknown
  return Array.isArray(body) ? (body as WooProduct[]) : []
}

export const experimentalSpaceAdapter: DesignerAdapter = {
  slug: "experimental-space",
  label: "Experimental Space",
  matchHosts: ["experimentalspace.com", "www.experimentalspace.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: WooProduct[] = []
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
