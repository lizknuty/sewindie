// ---------------------------------------------------------------------------
// Shared WooCommerce Store API helpers.
//
// The WC Store API (/wp-json/wc/store/v1/products) is public and needs no auth.
// It paginates with ?per_page=&page= and returns [] past the last page. Note:
// the Store API does NOT expose date_created on every store, so releaseDate may
// be null -- callers should treat a missing date as null, not an error.
//
// Extracted from the Lenaline adapter so multiple Woo designers share one
// fetch/paginate/decode implementation. Lenaline keeps its own inlined copy so
// a verified adapter is not disturbed.
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const MAX_PAGES = 40
const REQUEST_TIMEOUT_MS = 25_000
// Short timeout for the initial probe so a hanging path/size fails over fast
// instead of burning the full request timeout on every retry. Kept tight (6s)
// because a slow page-1 signals a heavy per-product payload that will be flaky
// across every page -- better to fail over to a smaller page size (proven to
// respond in ~1s on such stores) than commit to a large, timeout-prone one.
const PROBE_TIMEOUT_MS = 6_000
const PAGE_DELAY_MS = 250
// Committed pages get several attempts: heavy stores intermittently hang a
// single page for >15s but serve it fine on the next try.
const MAX_ATTEMPTS = 4
const RETRY_BASE_DELAY_MS = 600
// The versioned Store API path is preferred, but some stores only respond
// reliably on the unversioned path (or vice-versa), so we fall back across both.
const STORE_API_PATHS = ["/wp-json/wc/store/v1/products", "/wp-json/wc/store/products"] as const
// Page-size candidates: 100 is fast for normal stores, but some stores have huge
// per-product payloads where a large page times out, so we fall back to a small
// page (proven to respond quickly on such stores). The chosen size is reused for
// the rest of the pagination. A smaller size means more pages, hence MAX_PAGES.
const PER_PAGE_CANDIDATES = [100, 20] as const

export type WooProduct = {
  id: number
  name?: string
  slug?: string
  permalink?: string
  type?: string
  date_created?: string
  images?: Array<{ src?: string }>
  categories?: Array<{ id?: number; name?: string; slug?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function decodeEntities(value: string): string {
  return (value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
}

// Fetch one Store API page as an array. On a probe (page 1) a short timeout and
// single attempt are used so a hanging endpoint fails over quickly; committed
// pagination retries transient failures (5xx, 429, network/timeout).
async function fetchWooPage(url: string, probe: boolean): Promise<WooProduct[]> {
  const attempts = probe ? 1 : MAX_ATTEMPTS
  const timeout = probe ? PROBE_TIMEOUT_MS : REQUEST_TIMEOUT_MS
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeout),
        cache: "no-store",
      })
      if (res.ok) {
        const body = (await res.json()) as unknown
        return Array.isArray(body) ? (body as WooProduct[]) : []
      }
      lastError = new Error(`Woo Store API returned ${res.status} for ${url}`)
    } catch (error) {
      lastError = error
    }
    if (attempt < attempts) await sleep(RETRY_BASE_DELAY_MS * attempt)
  }
  throw lastError instanceof Error ? lastError : new Error(`Woo Store API request failed for ${url}`)
}

// Fetch every product from a WooCommerce Store API base URL (e.g.
// "https://example.com"), following pagination until exhausted. Dedupes by id.
// Probes each (endpoint path, page size) combination and commits to the first
// that responds, so a store that only works on the unversioned path or only
// with a smaller page size is still crawled fully.
//
// NOTE: a rare store has ONE pathological product whose paginated listing hangs
// server-side at every page size. For those, the Store API listing cannot be
// crawled reliably -- write a dedicated sitemap-crawl adapter instead (see
// sew-a-little-seam.ts), which fetches products individually.
export async function fetchWooProducts(base: string): Promise<WooProduct[]> {
  const root = base.replace(/\/$/, "")
  let lastError: unknown

  for (const perPage of PER_PAGE_CANDIDATES) {
    for (const path of STORE_API_PATHS) {
      const pageUrl = (page: number) => `${root}${path}?per_page=${perPage}&page=${page}`
      let firstPage: WooProduct[]
      try {
        firstPage = await fetchWooPage(pageUrl(1), true)
      } catch (error) {
        lastError = error
        continue // this (path, size) errored/hung: try the next combination
      }

      const byId = new Map<number, WooProduct>()
      for (const p of firstPage) if (p && typeof p.id === "number") byId.set(p.id, p)

      // Continue paginating this working combination (with full retries).
      if (firstPage.length === perPage) {
        for (let page = 2; page <= MAX_PAGES; page++) {
          await sleep(PAGE_DELAY_MS)
          const batch = await fetchWooPage(pageUrl(page), false)
          if (batch.length === 0) break
          for (const p of batch) if (p && typeof p.id === "number") byId.set(p.id, p)
          if (batch.length < perPage) break
        }
      }
      return [...byId.values()]
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Woo Store API failed for ${root}`)
}

// Fetch a single WooCommerce product by numeric id via the Store API. Used by
// sitemap-crawl adapters for stores whose paginated listing is unreliable.
export async function fetchWooProductById(base: string, id: number): Promise<WooProduct | null> {
  const root = base.replace(/\/$/, "")
  for (const path of STORE_API_PATHS) {
    try {
      const res = await fetch(`${root}${path}/${id}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      if (!res.ok) continue
      const body = (await res.json()) as unknown
      if (body && typeof (body as WooProduct).id === "number") return body as WooProduct
    } catch {
      // try the next endpoint path
    }
  }
  return null
}
