import type { ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Shared WordPress "product" custom-post-type crawler.
//
// Some WordPress/WooCommerce stores DISABLE the WC Store API
// (/wp-json/wc/store/v1/products returns 404) but still expose the underlying
// "product" custom post type through the core WP REST API at
// /wp-json/wp/v2/product. That endpoint returns the CPT rows with:
//   - title.rendered   -> product name (HTML-entity encoded)
//   - link             -> product page URL
//   - date             -> publish date (ISO, no timezone suffix)
//   - featured_media   -> media id; with ?_embed=1 the image URL is available
//                         at _embedded["wp:featuredmedia"][0].source_url
//   - _embedded["wp:term"] -> taxonomy terms (product_cat etc.) when embedded
//
// It paginates with ?per_page=&page= and exposes the total page count in the
// X-WP-TotalPages response header. Prices are NOT exposed here (the CPT has no
// price field), which is fine -- the pattern index does not need price.
//
// This is the fallback for WordPress designers whose Store API is off; prefer
// woo-store.ts (richer: categories, prices) whenever the Store API responds.
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 25_000
const PAGE_DELAY_MS = 250

export type WpCptProduct = {
  id: number
  link?: string
  slug?: string
  date?: string
  title?: { rendered?: string }
  featured_media?: number
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>
    "wp:term"?: Array<Array<{ taxonomy?: string; name?: string; slug?: string }>>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Categories/tags attached to a CPT row (empty unless the store registers the
// taxonomy on the REST endpoint). Flattened across all embedded taxonomies.
export function wpCptTerms(product: WpCptProduct): string[] {
  return (product._embedded?.["wp:term"] ?? []).flat().map((t) => t?.name ?? "").filter(Boolean)
}

export function wpCptImage(product: WpCptProduct): string | null {
  return product._embedded?.["wp:featuredmedia"]?.find((m) => m?.source_url)?.source_url ?? null
}

async function fetchCptPage(url: string): Promise<WpCptProduct[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`WP CPT endpoint returned ${res.status} for ${url}`)
  const body = (await res.json()) as unknown
  return Array.isArray(body) ? (body as WpCptProduct[]) : []
}

// Fetch every row of a WordPress "product" (or other) custom post type from a
// site base URL (e.g. "https://example.com"), embedding media + terms.
export async function fetchWpCptProducts(base: string, postType = "product"): Promise<WpCptProduct[]> {
  const root = base.replace(/\/$/, "")
  const pageUrl = (page: number) => `${root}/wp-json/wp/v2/${postType}?per_page=100&page=${page}&_embed=1`

  const byId = new Map<number, WpCptProduct>()
  const first = await fetchCptPage(pageUrl(1))
  for (const p of first) if (p && typeof p.id === "number") byId.set(p.id, p)

  if (first.length === 100) {
    for (let page = 2; page <= MAX_PAGES; page++) {
      await sleep(PAGE_DELAY_MS)
      const batch = await fetchCptPage(pageUrl(page))
      if (batch.length === 0) break
      for (const p of batch) if (p && typeof p.id === "number") byId.set(p.id, p)
      if (batch.length < 100) break
    }
  }
  return [...byId.values()]
}

export type WpCptMapping = {
  cleanName: (rawTitle: string) => string
  classify: (name: string, product: WpCptProduct) => ProductKind
}

export function cptToPattern(base: string, product: WpCptProduct, mapping: WpCptMapping): ScrapedPattern | null {
  const name = mapping.cleanName(product.title?.rendered ?? "")
  if (!name) return null
  return {
    name,
    url: product.link ?? base,
    imageUrl: wpCptImage(product),
    releaseDate: product.date ? new Date(product.date).toISOString() : null,
    kind: mapping.classify(name, product),
    sourceId: String(product.id),
  }
}
