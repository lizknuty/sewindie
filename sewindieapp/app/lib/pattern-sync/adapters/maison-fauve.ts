import type { DesignerAdapter, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Maison Fauve
// ---------------------------------------------------------------------------
// A large French Shopify shop (~407 products) selling fabric, notions and boxes
// alongside patterns. Three product_type values hold patterns:
//   "Patron de couture pdf"  (108)  -> PDF pattern
//   "PDF Gratuit"            (~26)  -> free PDF pattern
//   "Patron pochette"        (~77)  -> the PAPER (envelope) version
// Everything else (tissu/fabric, boutons, aiguilles, coffret, ...) is excluded.
//
// Two transforms make this catalogue sane:
//
//  1. DROP "COMPLEMENT" ADD-ONS. ~11 products are "Complément patron couture
//     gratuit ... - version <X>" -- free view/variation add-ons for an existing
//     pattern (e.g. a sleeveless view of the Rosalie dress), NOT standalone
//     patterns. They share a design name with their parent and would otherwise
//     both collide the collapse key and pollute the catalogue, so they are
//     excluded outright.
//
//  2. COLLAPSE PDF + POCHETTE (paper) OF THE SAME DESIGN. Nearly every design
//     exists as both a "Patron de couture pdf" and a "Patron pochette". They are
//     one design in two formats, so we collapse on a key derived from the
//     garment + model phrase: lower-cased title with the leading
//     "patron [de ]couture " stripped and everything from the format marker
//     (" / pdf", " - patron pochette", " / patron pochette", "- papier") onward
//     removed. Verified: 200 non-complement products -> 143 designs, 57 clean
//     PDF/pochette merges, ZERO 3+ collisions (i.e. no two distinct designs
//     share a key). The PDF (or free-PDF) listing is canonical when present;
//     a pochette-only design (17 of them) keeps its paper listing.
//
// Names are cleaned for display (strip the "Patron [de ]couture " prefix and the
// format tail) but kept in French. Identity is the Shopify id of the CANONICAL
// listing. published_at is a real staggered release date and is kept.
// ---------------------------------------------------------------------------

const STORE = "https://www.maison-fauve.com"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const PER_PAGE = 250
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type values that hold patterns.
const PATTERN_TYPE = /patron|pdf gratuit/i
// A free-view/variation add-on, not a standalone pattern (decision 1).
const COMPLEMENT = /compl[eé]ment/i

// Leading brand prefix and the format marker where the "real" title ends.
const LEADING_PREFIX = /^patron\s+(?:de\s+couture\s+|couture\s+)?/i
const FORMAT_MARKER = /\s*[/–-]\s*(?:pdf|patron\s+pochette|pochette|papier|version)\b.*$/i

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Collapse key: garment + model phrase, lower-cased, accents kept. Strips the
// leading "Patron [de ]couture " and the format tail. See decision 2.
export function fauveCollapseKey(title: string): string {
  let t = (title ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  t = t.replace(LEADING_PREFIX, "")
  t = t.replace(FORMAT_MARKER, "")
  // Remove any stray punctuation left at the ends.
  return t.replace(/[^a-zàâäéèêëïîôùûüç0-9 ]/g, "").replace(/\s+/g, " ").trim()
}

// Display name: strip the "Patron [de ]couture " prefix and the format tail,
// re-capitalise the first letter, keep French.
export function cleanFauveName(title: string): string {
  let t = (title ?? "").replace(/\s+/g, " ").trim()
  t = t.replace(LEADING_PREFIX, "")
  t = t.replace(FORMAT_MARKER, "")
  t = t.replace(/\s*[-–/]\s*$/, "").trim()
  if (!t) return (title ?? "").trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function isPdf(product: ShopifyProduct): boolean {
  return /pdf/i.test(product.product_type ?? "")
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Maison Fauve returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const maisonFauveAdapter: DesignerAdapter = {
  slug: "maison-fauve",
  label: "Maison Fauve",
  matchHosts: ["maison-fauve.com", "www.maison-fauve.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    // Pattern-type products, excluding "complément" free add-ons (decision 1).
    const patterns = products.filter(
      (p) => PATTERN_TYPE.test(p.product_type ?? "") && !COMPLEMENT.test(p.title ?? ""),
    )

    // Collapse PDF + pochette of the same design (decision 2). PDF/free-PDF
    // wins as canonical; a pochette-only design keeps its paper listing.
    const byKey = new Map<string, { product: ShopifyProduct; isPdf: boolean }>()
    for (const product of patterns) {
      const key = fauveCollapseKey(product.title ?? "")
      if (!key) continue
      const pdf = isPdf(product)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, { product, isPdf: pdf })
      } else if (pdf && !existing.isPdf) {
        byKey.set(key, { product, isPdf: pdf }) // upgrade paper -> PDF canonical
      }
    }

    const results: ScrapedPattern[] = []
    for (const { product } of byKey.values()) {
      const name = cleanFauveName(product.title ?? "")
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
