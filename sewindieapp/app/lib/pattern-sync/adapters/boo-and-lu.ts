import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Boo and Lu Sewing Patterns
// ---------------------------------------------------------------------------
// WordPress + WooCommerce, the same stack as 5 out of 4 Patterns and Patterns
// for Pirates, so it exposes the public, unauthenticated WP REST API -- no HTML
// scraping. The JSON carries name, product URL, featured image and publish
// date.
//
// Verified shape (324 products, 4 pages at per_page=100):
//   /wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL (/product/<slug>/)
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     date                                        -> release date
//     product_cat                                 -> taxonomy term ids
//
// Four store-specific details are worth spelling out.
//
//  1. NOTHING IS EXCLUDED. Unlike 5 out of 4 (cut files) and Brindille & Twig
//     (gift cards), this store sells only sewing patterns -- every one of the
//     324 products is a pattern. There are no cut files, gift cards, kits,
//     coupons or fabric products to filter out, so the catalogue is taken whole.
//
//  2. BUNDLE DETECTION IS THE UNION OF TWO SIGNALS, not either one alone --
//     the key difference from 5 out of 4, where the category was a clean
//     superset. Here neither signal is complete:
//       - the `bundles` category tags 106 products, but 22 of them do NOT say
//         "bundle" in the title -- they are child+adult / baby+adult combos like
//         "Child & Adult Sakura Top & Dress", which the store treats as bundles;
//       - 3 products say "Bundle" in the title but are NOT in the category
//         (e.g. "Baby Wren and Fawn Digital Sewing Pattern Bundle") -- the store
//         simply forgot to categorise them.
//     So a product is a bundle if it is in the `bundles` category OR its title
//     contains "bundle". That yields 109 bundles; every real bundle is caught
//     without either signal being trusted alone.
//
//  3. TITLES ARE VERBATIM. 18 of the matched rows differ from the store only by
//     capitalisation, and in every case the database holds the damaged form --
//     "Adult Olive Top And Dress" against the store's correct "Adult Olive Top
//     and Dress". That is the same title-casing damage seen on the 5 out of 4,
//     Violette Field Threads, Peek-a-Boo and Ellie and Mac rows, so titles are
//     passed through exactly as the store gives them -- decoding HTML entities
//     but never re-casing.
//
//  4. RELEASE DATE COMES FROM THE WOOCOMMERCE PUBLISH DATE. Unlike the Shopify
//     adapters (whose published_at is dominated by migration batches), this
//     store's dates spread across 104 distinct days from 2022 to 2026 with only
//     modest release-drop clusters, so `date` is a genuine release date -- the
//     same call the 5 out of 4 and Patterns for Pirates adapters make on this
//     platform.
// ---------------------------------------------------------------------------

const BASE = "https://booandlu.com/wp-json/wp/v2"

// A real browser UA. Some WordPress hosts serve a challenge page to obviously
// scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// Safety valve so a pagination bug upstream can't spin us forever. 4 pages is
// the current real count; 10 leaves room for the shop to grow.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Resolved to a term id at runtime so a renamed/re-ordered taxonomy doesn't
// silently break bundle detection. See note 2.
const BUNDLE_SLUGS = ["bundles"]

// Title fallback for bundles the store forgot to categorise -- see note 2.
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
 * WordPress returns titles as HTML, so `Women's Liana` arrives as
 * `Women&#8217;s Liana` and `Top & Dress` as `Top &amp; Dress`. Decode the
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
    throw new Error(`Boo and Lu returned ${res.status} for ${url}`)
  }

  return { body: await res.json(), headers: res.headers }
}

/** Resolves the `bundles` product_cat term id. See note 2. */
async function fetchBundleCategoryIds(): Promise<Set<number>> {
  const { body } = await getJson(`${BASE}/product_cat?per_page=100`)
  const terms = (Array.isArray(body) ? body : []) as WpTerm[]
  return new Set(terms.filter((t) => BUNDLE_SLUGS.includes(t.slug?.toLowerCase() ?? "")).map((t) => t.id))
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

export const booAndLuAdapter: DesignerAdapter = {
  slug: "boo-and-lu",
  label: "Boo and Lu Sewing Patterns",
  matchHosts: ["booandlu.com", "www.booandlu.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const [bundleCategoryIds, products] = await Promise.all([fetchBundleCategoryIds(), fetchProducts()])

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      // Capitalisation left exactly as the store has it -- see note 3.
      const name = decodeEntities(product.title?.rendered ?? "")
      if (!name || !product.link) continue

      if (seen.has(product.link)) continue
      seen.add(product.link)

      // Bundle if categorised OR titled as one -- neither signal alone is
      // complete. See note 2.
      const terms = product.product_cat ?? []
      const isBundle = terms.some((id) => bundleCategoryIds.has(id)) || BUNDLE_TITLE.test(name)
      const kind: ProductKind = isBundle ? "bundle" : "pattern"

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
