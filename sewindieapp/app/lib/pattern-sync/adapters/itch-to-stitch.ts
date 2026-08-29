import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Itch to Stitch
// ---------------------------------------------------------------------------
// WordPress + WooCommerce, the same stack as Boo and Lu, Love Notions, 5 out of
// 4 and Patterns for Pirates, so it exposes the public, unauthenticated WP REST
// API -- no HTML scraping.
//
// Verified shape (151 products, 2 pages at per_page=100):
//   /wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL (/product/<slug>/)
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     date                                        -> release date
//     product_cat                                 -> taxonomy term ids
//
// This is the cleanest of the WooCommerce stores -- it sells nothing but sewing
// patterns. Four things were confirmed against the live store:
//
//  1. THE CATALOGUE IS TAKEN WHOLE, save one defensive exclusion. Every one of
//     the 151 products is a garment pattern named "<Name> <Garment> Digital
//     Sewing Pattern (PDF)"; there are no cut files, kits, courses, tools or
//     fabric here. The `gift-card` category exists but is empty (count 0); it is
//     excluded anyway so a future gift card can never leak in. All 151 products
//     matched a real pattern URL -- 130 existing plus 21 new -- so the filter is
//     effectively a no-op today and exists only as a guard.
//
//  2. TITLES ARE VERBATIM. All 130 matched rows differ from the store, but in
//     exactly one way every time: the database lower-cased the PDF acronym to
//     "(Pdf)" while the store correctly has "(PDF)". That is the same
//     title-casing damage seen across the other adapters, so titles pass through
//     exactly as the store gives them -- entities decoded, never re-cased -- and
//     the sync's URL match (not the title) is what pairs them to existing rows.
//
//  3. THERE ARE NO BUNDLES. No product title contains "bundle"; the "&" titles
//     like "Simien Top & Dress" or "Kashi Tee & Dress" are single multi-view
//     patterns, not bundles. The title check is kept for parity with the other
//     adapters so a future bundle is classified without a code change, but it
//     matches nothing today and every product is a plain "pattern".
//
//  4. RELEASE DATE COMES FROM THE WOOCOMMERCE PUBLISH DATE. Unlike Love Notions
//     and the migrated Shopify stores, this store's dates are pristine: 144
//     distinct days spread from 2015 to 2026 with NO migration batch (not a
//     single day carries five or more products), so `date` is a genuine release
//     date -- the same call the Boo and Lu, 5 out of 4 and Patterns for Pirates
//     adapters make on this platform.
// ---------------------------------------------------------------------------

const BASE = "https://itch-to-stitch.com/wp-json/wp/v2"

// A real browser UA. Some WordPress hosts serve a challenge page to obviously
// scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// 2 pages is the current real count; 10 leaves room for the shop to grow.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Defensive only -- see note 1. Resolved to a term id at runtime.
const EXCLUDE_SLUGS = ["gift-card"]

// Kept for parity with the other adapters; matches nothing today -- see note 3.
const BUNDLE_TITLE = /\bbundles?\b/i

type WpTerm = { id: number; slug: string; name: string; count: number }

type WpProduct = {
  id: number
  date: string | null
  link: string
  slug?: string
  title?: { rendered?: string }
  product_cat?: number[]
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * WordPress returns titles as HTML, so `Women's Algarve` arrives as
 * `Women&#8217;s Algarve` and `Top & Dress` as `Top &amp; Dress`. Decode the
 * entities WP actually emits, including numeric escapes, so names match what a
 * human sees on the site.
 */
export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  }

  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => named[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim()
}

async function getJson(url: string): Promise<{ body: unknown; headers: Headers }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Itch to Stitch returned ${res.status} for ${url}`)
  }

  return { body: await res.json(), headers: res.headers }
}

/** Resolves the excluded product_cat term ids (defensive -- see note 1). */
async function fetchExcludedCategoryIds(): Promise<Set<number>> {
  const { body } = await getJson(`${BASE}/product_cat?per_page=100`)
  const terms = (Array.isArray(body) ? body : []) as WpTerm[]
  return new Set(terms.filter((t) => EXCLUDE_SLUGS.includes(t.slug?.toLowerCase() ?? "")).map((t) => t.id))
}

async function fetchProducts(): Promise<WpProduct[]> {
  const all: WpProduct[] = []
  let totalPages = 1

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}/product?per_page=${PER_PAGE}&page=${page}&_embed=wp:featuredmedia&orderby=date&order=desc`
    const { body, headers } = await getJson(url)

    if (page === 1) {
      const reported = Number(headers.get("x-wp-totalpages") ?? "1")
      totalPages = Number.isFinite(reported) && reported > 0 ? reported : 1
    }

    const batch = (Array.isArray(body) ? body : []) as WpProduct[]
    all.push(...batch)

    if (page >= totalPages || batch.length === 0) break
    await sleep(PAGE_DELAY_MS)
  }

  return all
}

export const itchToStitchAdapter: DesignerAdapter = {
  slug: "itch-to-stitch",
  label: "Itch to Stitch",
  matchHosts: ["itch-to-stitch.com", "www.itch-to-stitch.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const [excludedCategoryIds, products] = await Promise.all([fetchExcludedCategoryIds(), fetchProducts()])

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      // Capitalisation left exactly as the store has it -- see note 2.
      const name = decodeEntities(product.title?.rendered ?? "")
      if (!name || !product.link) continue

      // Defensive gift-card guard -- see note 1.
      const terms = product.product_cat ?? []
      if (terms.some((id) => excludedCategoryIds.has(id))) continue

      if (seen.has(product.link)) continue
      seen.add(product.link)

      const kind: ProductKind = BUNDLE_TITLE.test(name) ? "bundle" : "pattern"

      results.push({
        name,
        url: product.link,
        imageUrl: product._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        // WooCommerce publish date, a genuine release date here -- see note 4.
        releaseDate: product.date ?? null,
        kind,
        sourceId: String(product.id),
      })
    }

    return results
  },
}
