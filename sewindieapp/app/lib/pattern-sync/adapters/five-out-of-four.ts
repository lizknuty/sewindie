import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// 5 out of 4 Patterns runs WordPress + WooCommerce, the same stack as Patterns
// for Pirates, so it exposes the public, unauthenticated WP REST API and there
// is no HTML scraping. The JSON already carries the name, product URL, featured
// image and publish date.
//
// Verified shape (394 products, 4 pages at per_page=100):
//   /wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     date                                        -> release date
//     product_cat                                 -> taxonomy term ids
//     slug                                        -> stable product slug
//
// Four details are specific enough to this store to be worth spelling out.
//
//  1. THERE IS NO SINGLE "patterns" CATEGORY, so this filters by exclusion
//     rather than inclusion -- the opposite of Patterns for Pirates. The store
//     files garment patterns across dozens of categories (knit-patterns, tops,
//     dresses, swim, ...), so requiring one category would drop most of the
//     catalogue. Instead the things that are NOT standalone patterns are
//     removed:
//       - the three cut-file categories -- `cut-files` (87 Cricut/Silhouette
//         SVGs, the same craft the Ellie and Mac adapter drops as "Cutting
//         File"), `freebiecutfiles` (7) and `movembercutfiles` (4);
//       - any product whose TITLE ends in "Cut File". This title fallback is
//         load-bearing: 7 cut files (e.g. "BELIEVE Cut File", "I Regret Nothing
//         Cut File") are miscategorised upstream under `holiday` ONLY, with no
//         cut-file category, so the category filter alone misses them. Across
//         the whole catalogue 76 titles say "cut file" and NONE of them is an
//         existing catalogue row, so this drops zero real patterns;
//       - the single `gift-certificate` product.
//     Everything else -- including pet-clothing and bag/accessory patterns like
//     "Barker Blazer Pet Coat" and "Lily Handbag" -- is a real sewing pattern
//     and is kept. The combined rule keeps 308 of 394 products.
//
//  2. THE MATCH IS EXACT ON URL. All 294 existing rows resolve to a live product
//     by `link` alone -- 294 url-matches, zero name fallbacks -- so `product.link`
//     is exactly the stored shape (`/product/<slug>/`). After excluding cut-files
//     that scores 294 existing / 22 new.
//
//  3. BUNDLES COME FROM THE CATEGORY, not the title. The `bundled-patterns`
//     category (the WooCommerce Product Bundles plugin, visible in the
//     `bundled_by` / `bundle_layout` fields) tags 90 products; 85 of them also
//     say "bundle" in the title, and nothing says "bundle" in its title without
//     the category. The category is the strict superset, so it is the signal --
//     matching how Patterns for Pirates trusts its `bundles` term. This also
//     avoids a false "add-on": "DIY Scrunchie - 2 Ways Plus Bow Add-on!" is a
//     single standalone pattern, so the word "add-on" is deliberately NOT a
//     signal here.
//
//  4. TITLES ARE VERBATIM. 181 of the 294 matched rows differ from the store
//     only by capitalisation, and in every case the database holds the damaged
//     form -- "Agility Tank And Dress" against the store's correct "Agility Tank
//     and Dress", "Alpha Bra, Tank, And Dress" against "... and Dress". That is
//     the same title-casing damage seen on the Greenstyle, Violette Field
//     Threads, Peek-a-Boo and Ellie and Mac rows, so titles are passed through
//     exactly as the store gives them -- decoding HTML entities but never
//     re-casing.

const BASE = "https://5outof4.com/wp-json/wp/v2"

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

// Category slugs, resolved to term ids at runtime so a renamed/re-ordered
// taxonomy doesn't silently break filtering. See notes 1 and 3.
const BUNDLE_SLUGS = ["bundled-patterns"]
const EXCLUDE_SLUGS = ["cut-files", "freebiecutfiles", "movembercutfiles"]

// A single non-pattern product with no category of its own to exclude -- see
// note 1. Matched on its stable slug rather than its title.
const EXCLUDE_PRODUCT_SLUGS = new Set(["gift-certificate"])

// Catches cut files miscategorised upstream (filed under `holiday` only, with
// no cut-file category). Anchored to the end -- allowing trailing punctuation
// like "Love Cut File!" -- so a garment pattern that merely mentions cutting is
// never dropped. Matches all 76 cut-file titles; drops zero catalogue rows. See
// note 1.
const CUT_FILE_TITLE = /\bcut file\b[\s!.]*$/i

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
 * WordPress returns titles as HTML, so `Kids' Hannah` arrives as
 * `Kids&#8217; Hannah` and `2 Ways - Bow` as `2 Ways &#8211; Bow`. Decode the
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
    throw new Error(`5 out of 4 Patterns returned ${res.status} for ${url}`)
  }

  return { body: await res.json(), headers: res.headers }
}

/** Resolves the product_cat term ids we care about, keyed by role. */
async function fetchCategoryIds() {
  const { body } = await getJson(`${BASE}/product_cat?per_page=100&orderby=count&order=desc`)
  const terms = (Array.isArray(body) ? body : []) as WpTerm[]

  const idsFor = (slugs: string[]) =>
    new Set(terms.filter((t) => slugs.includes(t.slug?.toLowerCase() ?? "")).map((t) => t.id))

  return {
    bundles: idsFor(BUNDLE_SLUGS),
    excluded: idsFor(EXCLUDE_SLUGS),
  }
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

export const fiveOutOfFourAdapter: DesignerAdapter = {
  slug: "5-out-of-4-patterns",
  label: "5 out of 4 Patterns",
  matchHosts: ["5outof4.com", "www.5outof4.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const [categories, products] = await Promise.all([fetchCategoryIds(), fetchProducts()])

    const results: ScrapedPattern[] = []

    for (const product of products) {
      const terms = product.product_cat ?? []

      // Drop cut files by category -- a different craft, not patterns. See note 1.
      if (categories.excluded.size > 0 && terms.some((id) => categories.excluded.has(id))) continue

      // Drop the lone gift certificate, which has no category to exclude it by.
      if (product.slug && EXCLUDE_PRODUCT_SLUGS.has(product.slug.toLowerCase())) continue

      // Capitalisation left exactly as the store has it -- see note 4.
      const name = decodeEntities(product.title?.rendered ?? "")
      if (!name || !product.link) continue

      // Drop cut files miscategorised upstream, catchable only by title. See note 1.
      if (CUT_FILE_TITLE.test(name)) continue

      const kind: ProductKind = terms.some((id) => categories.bundles.has(id)) ? "bundle" : "pattern"

      results.push({
        name,
        url: product.link,
        imageUrl: product._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        // WooCommerce publish date, treated as release date -- the same call the
        // Patterns for Pirates adapter makes for this platform.
        releaseDate: product.date ?? null,
        kind,
        sourceId: String(product.id),
      })
    }

    return results
  },
}
