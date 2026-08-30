import type { DesignerAdapter, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Little Rosy Cheeks
// ---------------------------------------------------------------------------
// A Shopify shop dominated by iron-on/woven LABELS (~160 products); the sewing
// patterns are the ~28 products whose product_type contains "pattern" (values
// "Pattern" and "Sewing pattern"). Everything else -- labels, notions -- is
// excluded by that filter.
//
// FORMAT COLLAPSE: each design is sold in up to THREE listings that differ only
// by a format/audience descriptor:
//   "FOY Jumpsuit Adult's Pattern PDF"   +  "FOY Jumpsuit Adult's Pattern"
//   "CADAL Pyjamas pattern"  +  "CADAL Pyjamas pattern PDF"  +
//       "CADAL Pyjamas pattern - Children's Sewing Pattern"
//   "FOLLY Jumpsuit pattern" + "FOLLY Jumpsuit PDF" + "FOLLY Jumpsuit - Children's Sewing Pattern"
// These are one design in multiple formats, collapsed by a key that drops:
//   - a trailing "- Children's Sewing Pattern" descriptor (audience/format noise),
//   - a trailing "PDF"/"paper" token,
//   - the trailing "pattern" word.
// 28 listings -> 19 designs. The PDF listing wins as canonical when present,
// otherwise the first seen. The "Adult's" qualifier is REAL (distinguishes the
// adult version) and is kept in both key and name; "Children's Sewing" is a
// listing descriptor, not a qualifier, so it is dropped -- the kids designs
// (CADAL etc.) are the default un-qualified name.
//
// Titles keep the brand's ALL-CAPS design-name styling ("FOY", "CADAL"); only
// format descriptors are trimmed. published_at is a real release date.
// ---------------------------------------------------------------------------

const STORE = "https://www.littlerosycheeks.com"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const PER_PAGE = 250
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 200

const PATTERN_TYPE = /pattern/i

// A trailing "- Children's Sewing Pattern" listing descriptor (audience/format
// noise shared across the kids designs; NOT a distinguishing qualifier).
const CHILDRENS_DESCRIPTOR = /\s*[-–]\s*children['’]?s\s+sewing\s+pattern\s*$/i
// A trailing format token ("... PDF", "... paper") plus the word "pattern".
const FORMAT_TOKEN = /\s*\b(pdf|paper)\b\s*$/i
const PATTERN_WORD = /\s*\bpattern\b\s*$/i

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Strip every trailing format/audience descriptor from a title, in a loop so
// stacked tails ("... Pattern PDF", "... pattern - Children's Sewing Pattern")
// all come off. Preserves the design name's own casing + "Adult's" qualifier.
function stripFormatTails(title: string): string {
  let t = (title ?? "").replace(/\s+/g, " ").trim()
  let prev: string
  do {
    prev = t
    t = t.replace(CHILDRENS_DESCRIPTOR, "").trim()
    t = t.replace(FORMAT_TOKEN, "").trim()
    t = t.replace(PATTERN_WORD, "").trim()
  } while (t !== prev)
  return t
}

// Collapse key: format-stripped title, lower-cased. All three listings of a
// design ("FOY Jumpsuit Adult's Pattern PDF", "... Pattern", "... - Children's
// Sewing Pattern") reduce to the same key; "Adult's" stays so the adult version
// keeps a distinct key from a kids design.
export function lrcCollapseKey(title: string): string {
  return stripFormatTails(title).toLowerCase()
}

// Display name: same strip, preserving original casing.
export function cleanLrcName(title: string): string {
  return stripFormatTails(title) || (title ?? "").trim()
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Little Rosy Cheeks returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const littleRosyCheeksAdapter: DesignerAdapter = {
  slug: "little-rosy-cheeks",
  label: "Little Rosy Cheeks",
  matchHosts: ["littlerosycheeks.com", "www.littlerosycheeks.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const patterns = products.filter((p) => PATTERN_TYPE.test(p.product_type ?? ""))

    // Collapse PDF/paper format pairs, preferring the PDF listing as canonical.
    const byKey = new Map<string, { product: ShopifyProduct; isPdf: boolean }>()
    for (const product of patterns) {
      const key = lrcCollapseKey(product.title ?? "")
      if (!key) continue
      const isPdf = /\bpdf\b/i.test(product.title ?? "")
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, { product, isPdf })
      } else if (isPdf && !existing.isPdf) {
        byKey.set(key, { product, isPdf }) // upgrade to the PDF listing
      }
    }

    const results: ScrapedPattern[] = []
    for (const { product } of byKey.values()) {
      const name = cleanLrcName(product.title ?? "")
      if (!name) continue
      results.push({
        name,
        url: `${STORE}/products/${(product.handle ?? "").trim()}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }
    return results
  },
}
