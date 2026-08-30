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

// Recover a single failed page's item window by fetching one product at a time
// (per_page=1). Occasionally a store has ONE pathological product that makes the
// Store API hang for its whole page regardless of page size; fetching per item
// isolates and skips only that product instead of losing the entire page (and
// aborting the crawl). Returns the products recovered and whether the window
// reached the end of the catalogue (an empty single-item page).
async function recoverWooPageItems(
  pageUrl: (perPage: number, page: number) => string,
  failedPage: number,
  perPage: number,
): Promise<{ items: WooProduct[]; reachedEnd: boolean }> {
  const startIndex = (failedPage - 1) * perPage + 1 // 1-based index of first item
  const items: WooProduct[] = []
  let reachedEnd = false
  for (let i = 0; i < perPage; i++) {
    await sleep(PAGE_DELAY_MS)
    try {
      // per_page=1 & page=N returns the Nth product (1-based).
      const single = await fetchWooPage(pageUrl(1, startIndex + i), false)
      if (single.length === 0) {
        reachedEnd = true
        break
      }
      items.push(...single)
    } catch {
      // This individual product is the broken one -- skip it and continue.
    }
  }
  return { items, reachedEnd }
}

// Fetch every product from a WooCommerce Store API base URL (e.g.
// "https://example.com"), following pagination until exhausted. Dedupes by id.
// Probes each (endpoint path, page size) combination and commits to the first
// that responds, so a store that only works on the unversioned path or only
// with a smaller page size is still crawled fully. A page that fails all retries
// is recovered item-by-item rather than aborting the whole crawl.
export async function fetchWooProducts(base: string): Promise<WooProduct[]> {
  const root = base.replace(/\/$/, "")
  let lastError: unknown

  for (const perPage of PER_PAGE_CANDIDATES) {
    for (const path of STORE_API_PATHS) {
      const pageUrl = (size: number, page: number) => `${root}${path}?per_page=${size}&page=${page}`
      let firstPage: WooProduct[]
      try {
        firstPage = await fetchWooPage(pageUrl(perPage, 1), true)
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
          let batch: WooProduct[]
          try {
            batch = await fetchWooPage(pageUrl(perPage, page), false)
          } catch {
            // Page hung on a pathological product: recover the window item-by-item.
            const { items, reachedEnd } = await recoverWooPageItems(pageUrl, page, perPage)
            for (const p of items) if (p && typeof p.id === "number") byId.set(p.id, p)
            if (reachedEnd) break
            continue
          }
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
