import type { DesignerAdapter, ScrapedPattern } from "../types"

// Patterns for Pirates runs WordPress + WooCommerce, which exposes a public,
// unauthenticated WP REST API. That means no HTML scraping: the JSON already
// contains the name, product URL, featured image and publish date.
//
// Verified shape (382 products, 4 pages at per_page=100):
//   /wp-json/wp/v2/product?per_page=100&_embed=wp:featuredmedia
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     date                                        -> release date
//     product_cat                                 -> taxonomy term ids

const BASE = "https://www.patternsforpirates.com/wp-json/wp/v2"

// A real browser UA. Some WordPress hosts serve a challenge page to obviously
// scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// Safety valve so a pagination bug upstream can't spin us forever. 4 pages is
// the current real count; 10 leaves room for the shop to grow.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
// Small courtesy gap between page requests.
const PAGE_DELAY_MS = 250

// Category slugs that identify what a product actually is. Resolved to term ids
// at runtime so a renamed/re-ordered taxonomy doesn't silently break filtering.
const PATTERNS_SLUGS = ["patterns"]
const BUNDLE_SLUGS = ["bundles", "bundle"]
const EXCLUDE_SLUGS = ["gift-cards", "gift-card", "fabric", "fabrics"]

type WpTerm = { id: number; slug: string; name: string; count: number }

type WpProduct = {
  id: number
  date: string | null
  link: string
  title?: { rendered?: string }
  product_cat?: number[]
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * WordPress returns titles as HTML, so `Boo! – Youth` arrives as
 * `Boo! &#8211; Youth`. Decode the entities WP actually emits, including
 * numeric escapes, so names match what a human sees on the site.
 */
function decodeEntities(input: string): string {
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
    throw new Error(`Patterns for Pirates returned ${res.status} for ${url}`)
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
    patterns: idsFor(PATTERNS_SLUGS),
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

export const patternsForPiratesAdapter: DesignerAdapter = {
  slug: "patterns-for-pirates",
  label: "Patterns for Pirates",
  matchHosts: ["patternsforpirates.com", "www.patternsforpirates.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const [categories, products] = await Promise.all([fetchCategoryIds(), fetchProducts()])

    const results: ScrapedPattern[] = []

    for (const product of products) {
      const terms = product.product_cat ?? []

      // Drop gift cards, fabric and other non-pattern merchandise outright.
      if (terms.some((id) => categories.excluded.has(id))) continue

      // Keep only things the shop itself files under Patterns. If the taxonomy
      // lookup came back empty, fall back to keeping everything rather than
      // silently reporting zero new patterns.
      if (categories.patterns.size > 0 && !terms.some((id) => categories.patterns.has(id))) continue

      const name = decodeEntities(product.title?.rendered ?? "")
      if (!name || !product.link) continue

      results.push({
        name,
        url: product.link,
        imageUrl: product._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        releaseDate: product.date ?? null,
        isBundle: terms.some((id) => categories.bundles.has(id)),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
