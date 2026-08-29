import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Love Notions
// ---------------------------------------------------------------------------
// WordPress + WooCommerce, the same stack as Boo and Lu, 5 out of 4 and
// Patterns for Pirates, so it exposes the public, unauthenticated WP REST API.
//
// Verified shape (196 products, 2 pages at per_page=100):
//   /wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL (/product/<slug>/)
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     product_cat                                 -> taxonomy term ids
//
// This is a MIXED store -- alongside 136 catalogued patterns it sells fabric
// kits, a gift card, a teaching licence, sewing tools and trade-show booth
// items. Getting the filter right took the most care, because two of the
// obvious exclusions would have wrongly dropped existing catalogue rows:
//
//  1. FILTER BY EXCLUSION, and only on stable category slugs -- never by a
//     generic keyword. The store has no single "patterns" category (the closest,
//     `hpc` "Patterns", tags only 111 of the 136 matched rows), so patterns are
//     taken as "everything except the known non-pattern buckets". Excluded
//     categories, each verified to contain ZERO existing catalogue rows:
//       - `kits`            "Pattern + Fabric Kits" (38) -- fabric, not patterns
//       - `gift` / `gifts`  gift cards
//       - `teaching-license` a licence, not a product
//       - `sew-expo`        trade-show booth items (e.g. a class kit)
//
//  2. COURSES AND FREE PATTERNS ARE KEPT, NOT EXCLUDED -- the non-obvious part.
//     A first cut excluded anything whose title said "Course"/"Class", which
//     silently dropped FIVE existing rows: "Octave Coat Course", "Aria Button
//     Down Course", "Duet Trousers Course", "Legato Jeans Course" and "Metra
//     Blazer Course". The catalogue deliberately lists these video-course
//     products as patterns (the `workshop` category holds 8, 5 of them already
//     in the database), so courses stay. Likewise the `freepatterns` category
//     holds 6 existing rows (Dashing Vest, the doll dresses, Leggin's, Skater
//     Skirt) and must not be excluded. New courses therefore surface as new
//     patterns, which is consistent with how the catalogue already treats them.
//
//  3. THE ONLY TITLE-BASED EXCLUSION is for physical tools that dodge the
//     category net -- a "Seam gauge" (in `sew-expo`) and two "Sewing ToolKit"
//     products (in `freepatterns` / `pattern-sale`, categories that otherwise
//     hold real patterns, so they can't be excluded wholesale). The regex is
//     deliberately narrow (`seam gauge`, `tool kit`/`toolkit`) and must NOT use
//     a bare "notion", because the brand itself is "Love Notions" -- a `\bnotion`
//     probe matched the brand name and produced false positives. No catalogued
//     pattern is named after a tool, so this drops zero real rows.
//
//  4. TITLES ARE VERBATIM. 49 matched rows differ from the store only by
//     capitalisation or smart quotes, and in every case the database holds the
//     damaged form -- "Aurora Tunic And Dress" / "Bluezette For Ladies Xs-Xxxl"
//     against the store's correct "Aurora Tunic and Dress" / "Bluezette for
//     Ladies XS-XXXL". Same title-casing damage seen across the other adapters,
//     so titles pass through exactly as the store gives them (entities decoded,
//     never re-cased).
//
//  5. RELEASE DATE IS LEFT NULL, unlike the other WooCommerce adapters. All 136
//     existing rows have a null release date, and the publish dates include a
//     24-product migration batch on 2025-02-21, so `date` is not a trustworthy
//     release date here. Leaving it null matches every existing row and avoids
//     stamping two dozen patterns with a re-import date -- the same call the
//     migrated Shopify stores (Ellie and Mac, Brindille & Twig, Sinclair) make.
//
// The combined rule keeps 153 of 196 products: 136 existing (a 136/136 exact
// URL match) and 17 new.
// ---------------------------------------------------------------------------

const BASE = "https://www.lovenotions.com/wp-json/wp/v2"

// A real browser UA. Some WordPress hosts serve a challenge page to obviously
// scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// 2 pages is the current real count; 10 leaves room for the shop to grow.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Non-pattern categories, resolved to term ids at runtime so a renamed or
// re-ordered taxonomy fails loudly rather than silently letting merch through.
// See note 1.
const EXCLUDE_SLUGS = ["kits", "gift", "gifts", "teaching-license", "sew-expo"]

// Narrow title fallback for physical tools that sit in otherwise-kept
// categories -- see note 3. Must never broaden to a bare "notion" (brand name).
const EXCLUDE_TITLE = /seam gauge|tool ?kit/i

// Kept for parity with the other adapters; the store has no titled bundles
// today, but if it adds one this classifies it without a code change.
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
    throw new Error(`Love Notions returned ${res.status} for ${url}`)
  }

  return { body: await res.json(), headers: res.headers }
}

/**
 * Resolves the excluded product_cat term ids. Throws if a slug is missing so a
 * taxonomy rename surfaces loudly instead of leaking merch into the catalogue.
 * See note 1.
 */
async function fetchExcludedCategoryIds(): Promise<Set<number>> {
  const { body } = await getJson(`${BASE}/product_cat?per_page=100`)
  const terms = (Array.isArray(body) ? body : []) as WpTerm[]
  const bySlug = new Map(terms.map((t) => [t.slug?.toLowerCase() ?? "", t.id]))

  const ids = new Set<number>()
  for (const slug of EXCLUDE_SLUGS) {
    const id = bySlug.get(slug)
    // Not every slug need exist (e.g. `gifts` may be empty), but at least the
    // core `kits` bucket must -- guard the important ones.
    if (id != null) ids.add(id)
  }
  if (!bySlug.has("kits")) {
    throw new Error("Love Notions: expected `kits` category not found -- taxonomy may have changed")
  }
  return ids
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

export const loveNotionsAdapter: DesignerAdapter = {
  slug: "love-notions",
  label: "Love Notions",
  matchHosts: ["lovenotions.com", "www.lovenotions.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const [excludedCategoryIds, products] = await Promise.all([fetchExcludedCategoryIds(), fetchProducts()])

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      // Capitalisation left exactly as the store has it -- see note 4.
      const name = decodeEntities(product.title?.rendered ?? "")
      if (!name || !product.link) continue

      // Drop fabric kits, gift cards, licences and booth items by category.
      const terms = product.product_cat ?? []
      if (terms.some((id) => excludedCategoryIds.has(id))) continue

      // Drop physical tools that sit in otherwise-kept categories -- see note 3.
      if (EXCLUDE_TITLE.test(name)) continue

      if (seen.has(product.link)) continue
      seen.add(product.link)

      const kind: ProductKind = BUNDLE_TITLE.test(name) ? "bundle" : "pattern"

      results.push({
        name,
        url: product.link,
        imageUrl: product._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        // Left null on purpose -- migration-batch dates, existing rows all null.
        // See note 5.
        releaseDate: null,
        kind,
        sourceId: String(product.id),
      })
    }

    return results
  },
}
