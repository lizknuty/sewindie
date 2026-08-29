import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// I AM Patterns
// ---------------------------------------------------------------------------
// A French WooCommerce store (iampatterns.fr) running WPML: the primary catalogue
// is French, and the ENGLISH catalogue -- the one this site's rows were scraped
// from -- is served from the `/en/` locale prefix. Both the REST API
// (`/en/wp-json/wp/v2/product`) and the product permalinks
// (`/en/product/<slug>/`) live under that prefix, and those `/en/` permalinks are
// exactly what the catalogue stores, so product `link` maps 1:1 onto existing
// rows -- 109/109 matched by URL.
//
// NOTE ON ACCESS: unlike Ikatee (which migrated to a French-primary Shopify with
// all-new French handles and could not be joined), I AM keeps a real English
// storefront with stable English slugs, so the standard WooCommerce URL match
// works. The only reason to touch titles at all is casing -- see note 1.
//
// Four things make this its own adapter.
//
//  1. TITLES ARE TITLE-CASED, not passed through verbatim -- the same
//     deliberate house-rule break made for Brindille & Twig, for the same
//     reason: the store's own titles are LOWER quality than the catalogue. The
//     store shouts in ALL CAPS ("ANGEL", "APOLLON – Women", "DUO PDF – DIAMOND
//     & CRYSTAL") while the catalogue holds clean Title Case ("Angel",
//     "Apollon - Men"). 103 of 109 matched rows differ from the store only by
//     this casing, and the DB convention is unambiguous (97 Title-ish, 0
//     ALL-CAPS). Because every current row matches by URL, Title-casing only
//     ever NAMES NEW rows; it never rewrites an existing title.
//
//  2. THE EN-DASH SEPARATOR IS NORMALISED TO " - ". The store separates parts
//     with a spaced en-dash ("APOLLON – Women"); the catalogue overwhelmingly
//     uses a spaced hyphen ("Apollon - Men", 23 rows vs 7 en-dash). New-row
//     titles are normalised to the hyphen form to match the house convention.
//
//  3. CASING IS NAIVE, MATCHING THE CATALOGUE -- every word's first letter is
//     upper-cased and the rest lower-cased, with NO exceptions for minor words
//     or acronyms. The catalogue's own convention is exactly this: "I Am A
//     Miracle - 3 Pdf Patterns", "2 For 1 Pdf", "Back To The Future". So the
//     brand prefix becomes "I Am", "for" becomes "For", and even "PDF" becomes
//     "Pdf". This looks linguistically wrong but is deliberately faithful to how
//     the 109 existing rows are already written -- consistency with the
//     catalogue beats "correct" title casing here.
//
//  4. GIFT CARD IS DROPPED, FREE EXTENSIONS ARE KEPT. Exactly one non-pattern
//     exists -- a "Gift card" -- excluded by title. The "… Fabric Extension"
//     products in the `sewing-patterns-free-extensions` category are genuine
//     free pattern add-ons the catalogue already carries, so they are NOT
//     excluded.
//
//  Release date is left NULL: `date` is dominated by a 39-product migration
//  batch on 2019-02-15, so it is a bulk-import timestamp, not a release date,
//  and all 109 existing rows already have a null release_date.
// ---------------------------------------------------------------------------

const STORE = "https://iampatterns.fr"
// The English catalogue lives under the /en/ WPML locale prefix -- see header.
const API_BASE = `${STORE}/en/wp-json/wp/v2`

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// Catalogue is ~171 products (2 pages); 15 leaves generous headroom while making
// an upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 15
const REQUEST_TIMEOUT_MS = 30_000
const PAGE_DELAY_MS = 250

// Bundle detection: I AM flags multi-pattern products clearly in the title --
// "… PDF Patterns – Complete collection", "Duo PDF – …", "… Bundle 2 PDFs",
// "… Duo". The category `sewing-pattern-bundles` is a broader marketing bucket
// (it also tags single patterns sold in multi-size packs), so the title is the
// reliable signal.
const BUNDLE_TITLE = /\bbundle\b|\bduo\b|\btrio\b|complete collection|\d+\s*pdf\s*patterns?\b/i

// The single non-pattern product -- see note 4.
const NON_PATTERN_TITLE = /gift card|gift certificate|gift voucher/i

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type WpRendered = { rendered?: string }
type WpProduct = {
  id?: number
  link?: string
  title?: WpRendered
  date?: string
  featured_media?: number
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>
  }
}

// Decode the HTML entities the WP REST API returns in rendered titles, and fold
// the en-dash separator to a spaced hyphen to match the catalogue -- see note 2.
function decodeTitle(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/[\u2013\u2014]/g, "-") // en/em dash -> hyphen
    .replace(/\s+/g, " ")
    .trim()
}

// Capitalise one whitespace-separated token, splitting further on "-" and "/"
// so "t-shirt" -> "T-Shirt". Every alphabetic sub-part gets its first letter
// upper-cased and the rest lower-cased -- naive every-word Title Case, matching
// the catalogue exactly (see note 3). A sub-part that is purely non-alphabetic
// ("2", "1", "&") is left as-is.
function capitalizeToken(token: string): string {
  return token
    .split(/([-/])/) // keep the separators as their own array entries
    .map((part) => {
      if (part === "-" || part === "/") return part
      if (!/[a-z]/i.test(part)) return part // "2", "&", etc.
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join("")
}

export function toTitleCase(raw: string): string {
  const trimmed = raw
    .replace(/[\u2013\u2014]/g, "-") // en/em dash -> hyphen, matching the catalogue (note 2)
    .replace(/\s+/g, " ")
    .trim()
  if (!trimmed) return trimmed

  // Naive Title Case: capitalise EVERY word, including minor words and acronyms.
  // The catalogue's own convention is "I Am A Miracle - 3 Pdf Patterns", "2 For
  // 1 Pdf", "Back To The Future" -- so "I AM" -> "I Am", "for" -> "For" and even
  // "PDF" -> "Pdf". Matching that convention (rather than a linguistically
  // "correct" one) is what keeps NEW-row titles consistent with existing rows.
  return trimmed
    .split(/(\s+)/)
    .map((chunk) => (/^\s+$/.test(chunk) ? chunk : capitalizeToken(chunk)))
    .join("")
}

export function classify(title: string): ProductKind {
  return BUNDLE_TITLE.test(title) ? "bundle" : "pattern"
}

async function fetchPage(page: number): Promise<WpProduct[]> {
  const url = `${API_BASE}/product?per_page=${PER_PAGE}&page=${page}&_embed=wp:featuredmedia&orderby=date&order=desc`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  // WP returns 400 for a page past the end rather than an empty array; treat
  // that as "no more pages" instead of an error.
  if (res.status === 400) return []
  if (!res.ok) {
    throw new Error(`I AM Patterns returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as unknown
  return Array.isArray(body) ? (body as WpProduct[]) : []
}

export const iAmPatternsAdapter: DesignerAdapter = {
  slug: "i-am-patterns",
  label: "I AM Patterns",
  matchHosts: ["iampatterns.fr", "www.iampatterns.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: WpProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      const rawTitle = decodeTitle(product.title?.rendered ?? "")
      // Drop the gift card -- see note 4.
      if (!rawTitle || NON_PATTERN_TITLE.test(rawTitle)) continue

      const link = (product.link ?? "").trim()
      if (!link) continue

      // Title Case applied here, and ONLY here -- see notes 1, 2 and 3.
      const name = toTitleCase(rawTitle)

      // Normalise the permalink: strip a trailing slash so it matches the
      // catalogue's stored form, and dedupe.
      const url = link.replace(/\/+$/, "")
      if (seen.has(url)) continue
      seen.add(url)

      results.push({
        name,
        url,
        imageUrl: product._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        releaseDate: null, // see header
        kind: classify(rawTitle),
        sourceId: String(product.id ?? url),
      })
    }

    return results
  },
}
