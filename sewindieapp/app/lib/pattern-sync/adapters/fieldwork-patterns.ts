import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Fieldwork Patterns
// ---------------------------------------------------------------------------
// Small UK maker on Shopify. Fresh backfill (0 existing rows). The store is
// mostly NOT patterns -- it sells Janome sewing machines/overlockers, classes
// and a PDF-printing service alongside a handful of house patterns. The
// product_type field is unreliable here (most items, patterns included, have an
// empty type), so classification is TITLE-BASED:
//
//  1. PATTERNS ARE TITLES ENDING "... - Sewing Pattern". All 9 house patterns
//     follow "<NN> <NAME> - <Garment> - Sewing Pattern", e.g.
//     "09 BETH - Boxy Top - Sewing Pattern". Nothing else in the store matches
//     " - Sewing Pattern", so this cleanly excludes the machines, classes,
//     printing services and gift card. Note the store URL uses an /en-us locale
//     prefix for browsing, but /products.json and canonical /products/<handle>
//     URLs are locale-independent, so we use the bare host.
//
//  2. NAME = "<NAME> - <Garment>", DE-SHOUTED. We drop the leading sequence
//     number and the trailing " - Sewing Pattern[ - ...]" tail (one pattern
//     appends " - FREE to Newsletter Subscribers"), leaving "BETH - Boxy Top".
//     The brand styles the personal name in ALL CAPS; we title-case fully
//     uppercase words so it reads "Beth - Boxy Top".
//
//  3. RELEASE DATE KEPT. published_at values track the real release history.
//     The sequence number (from the raw title) is the stable identity key.
// ---------------------------------------------------------------------------

const STORE = "https://fieldworkpatterns.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// A pattern title contains this tag; everything from it onward is dropped from
// the name (covers the "... - FREE to Newsletter Subscribers" tail too).
const SEWING_PATTERN_TAG = /\s*[-–]\s*sewing\s+pattern\b.*$/i
// Leading design sequence number, e.g. "09 ", "01 ".
const LEADING_SEQUENCE = /^\d+\s+/

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Is this product one of the house patterns? Exported for unit tests.
export function isPattern(title: string): boolean {
  return /\bsewing\s+pattern\b/i.test(title)
}

// Title-case fully-uppercase words so the ALL-CAPS personal name reads normally
// ("BETH - Boxy Top" -> "Beth - Boxy Top"); mixed-case words are left as-is.
function deShout(text: string): string {
  return text.replace(/[A-Za-z][A-Za-z'’]*/g, (word) =>
    word === word.toUpperCase() ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word,
  )
}

// "09 BETH - Boxy Top - Sewing Pattern" -> "Beth - Boxy Top".
// Exported for the verify script's offline unit tests.
export function cleanName(title: string): string {
  const withoutTag = title.replace(/\s+/g, " ").trim().replace(SEWING_PATTERN_TAG, "")
  const withoutSeq = withoutTag.replace(LEADING_SEQUENCE, "").trim()
  return deShout(withoutSeq).trim()
}

// Stable sequence number ("09 BETH ..." -> "09"); falls back to handle.
function sequenceId(title: string, handle: string): string {
  const match = title.match(/^(\d+)\s+/)
  return match ? match[1] : handle
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Fieldwork Patterns returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Keep only house patterns and map them to scraped patterns.
// Exported for the verify script's offline unit tests.
export function toPatterns(products: ShopifyProduct[]): ScrapedPattern[] {
  const out: ScrapedPattern[] = []
  for (const product of products) {
    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle || !isPattern(rawTitle)) continue

    const name = cleanName(rawTitle)
    if (!name) continue

    out.push({
      name,
      url: `${STORE}${PRODUCTS_PATH}${handle}`,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      releaseDate: product.published_at ?? null,
      // Free patterns are still patterns; the "FREE ..." tail is already stripped.
      kind: "pattern" as ProductKind,
      sourceId: sequenceId(rawTitle, handle),
    })
  }
  return out
}

export const fieldworkPatternsAdapter: DesignerAdapter = {
  slug: "fieldwork-patterns",
  label: "Fieldwork Patterns",
  matchHosts: ["fieldworkpatterns.com", "www.fieldworkpatterns.com"],

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
