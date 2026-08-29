import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Brindille & Twig
// ---------------------------------------------------------------------------
// Shopify storefront, the same platform and URL shape as Violette Field
// Threads: patterns live at `/collections/all/products/<handle>` (NOT the bare
// `/products/<handle>` shape Ellie and Mac uses), and that longer form is
// exactly what the catalogue stores, so the products.json `handle` maps 1:1
// onto existing rows -- 172/172 matched by URL.
//
// Four things make this its own adapter rather than a VFT clone.
//
//  1. TITLES ARE TITLE-CASED, not passed through verbatim -- the one place this
//     adapter breaks the house rule, and deliberately. This is the only store
//     whose own titles are LOWER quality than the catalogue: 165 of ~196 titles
//     are lowercased ("a-line raglan dress : K025"), and the product page,
//     og:title and <h1> all carry that same lowercase form, so there is no
//     canonical-cased string anywhere in the store to fall back to. The
//     catalogue already holds clean Title Case, so new patterns are Title-cased
//     to match (confirmed with the user). `toTitleCase` reproduced the
//     catalogue's canonical form on 152/168 matched rows and beat it on 15 of
//     the other 16 -- it keeps season codes like "SS21" uppercase where the
//     catalogue had itself damaged them to "Ss21". Because every current row
//     matches by URL, this only ever names NEW rows; it never rewrites an
//     existing title.
//
//  2. PRODUCT CODES ARE PRESERVED. Titles end in a code after a colon -- "K025",
//     "GU06", "SS29", or a bare number like "83". `toTitleCase` uppercases any
//     token containing a digit and leaves its shape alone, so a code is never
//     lower-cased and a season prefix like "SS" never becomes "Ss".
//
//  3. GIFT CARDS ARE DROPPED. Six products carry product_type "Gift Card"
//     ("Brindille & Twig Gift $50 Card"). Everything else is "PDF pattern" or
//     has an empty product_type (a pattern and four bundles that predate the
//     type being set), so the filter is "not a Gift Card" rather than
//     "== PDF pattern", which would wrongly drop those untyped patterns.
//
//  4. RELEASE DATE IS LEFT NULL. published_at exists on every product but is
//     dominated by migration batches (multiple products sharing the same
//     second, e.g. 5x 2019-03-17T21:06:59), so it is a bulk-import timestamp,
//     not a release date -- the same call the Ellie and Mac adapter makes.
// ---------------------------------------------------------------------------

const STORE = "https://brindilletwig.com"
const PRODUCTS_PATH = "/collections/all/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// The catalogue is ~200 products (1 page); 12 leaves headroom while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type values that are not patterns -- see note 3.
const EXCLUDED_PRODUCT_TYPES = new Set(["gift card"])

// Bundle detection: the title is the reliable signal (all 6 bundles say
// "Bundle"); the `bundle` tag is only set on 1 of them, so it is an OR fallback.
const BUNDLE_TITLE = /\bbundles?\b/i
const BUNDLE_TAG = /^bundle$/i

// Kept lowercase inside a title unless they lead the whole title -- see note 1.
const MINOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "or",
  "for",
  "of",
  "to",
  "in",
  "on",
  "with",
  "by",
  "at",
  "vs",
])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type ShopifyProduct = {
  id?: number
  handle?: string
  title?: string
  product_type?: string
  tags?: string[]
  images?: Array<{ src?: string }>
}

// Capitalise one whitespace-separated token, splitting further on "-" and "/"
// so "t-shirt" -> "T-Shirt" and "shorts/pants" -> "Shorts/Pants". A token
// carrying a digit is a product code ("K025", "SS29", "83", "A0") and is
// uppercased wholesale -- see note 2.
function capitalizeToken(token: string, isTitleStart: boolean): string {
  if (/\d/.test(token)) return token.toUpperCase()

  return token
    .split(/([-/])/) // keep the separators as their own array entries
    .map((part, index) => {
      if (part === "-" || part === "/") return part
      const lower = part.toLowerCase()
      if (!(isTitleStart && index === 0) && MINOR_WORDS.has(lower)) return lower
      return lower.replace(/^[a-z]/, (c) => c.toUpperCase())
    })
    .join("")
}

export function toTitleCase(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim()
  if (!trimmed) return trimmed

  let seenWord = false
  return trimmed
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s+$/.test(chunk)) return chunk
      // Punctuation-only chunk (e.g. a stray ":") passes through unchanged.
      if (!/[a-z0-9]/i.test(chunk)) return chunk
      const isTitleStart = !seenWord
      seenWord = true
      return capitalizeToken(chunk, isTitleStart)
    })
    .join("")
}

export function classify(product: ShopifyProduct): ProductKind {
  const title = product.title ?? ""
  const tags = product.tags ?? []
  if (BUNDLE_TITLE.test(title) || tags.some((t) => BUNDLE_TAG.test(t))) return "bundle"
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Brindille & Twig returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const brindilleAndTwigAdapter: DesignerAdapter = {
  slug: "brindille-and-twig",
  label: "Brindille & Twig",
  matchHosts: ["brindilletwig.com", "www.brindilletwig.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

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
      // Drop gift cards -- not patterns. See note 3.
      if (EXCLUDED_PRODUCT_TYPES.has((product.product_type ?? "").trim().toLowerCase())) continue

      const handle = (product.handle ?? "").trim()
      // Title Case applied here, and ONLY here -- see notes 1 and 2.
      const name = toTitleCase(product.title ?? "")
      if (!name || !handle) continue

      // The `/collections/all/products/` shape, matching the catalogue.
      const url = `${STORE}${PRODUCTS_PATH}${handle}`
      if (seen.has(url)) continue
      seen.add(url)

      results.push({
        name,
        url,
        imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
        releaseDate: null, // see note 4
        kind: classify(product),
        sourceId: String(product.id ?? handle),
      })
    }

    return results
  },
}
