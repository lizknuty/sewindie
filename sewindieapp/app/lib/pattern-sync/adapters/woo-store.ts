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
const PER_PAGE = 100
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

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

// Fetch every product from a WooCommerce Store API base URL (e.g.
// "https://example.com"), following pagination until exhausted. Dedupes by id.
export async function fetchWooProducts(base: string): Promise<WooProduct[]> {
  const byId = new Map<number, WooProduct>()
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base.replace(/\/$/, "")}/wp-json/wc/store/v1/products?per_page=${PER_PAGE}&page=${page}`
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) {
      if (page === 1) throw new Error(`Woo Store API returned ${res.status} for ${url}`)
      break
    }
    const body = (await res.json()) as unknown
    const batch = Array.isArray(body) ? (body as WooProduct[]) : []
    if (batch.length === 0) break
    for (const p of batch) if (p && typeof p.id === "number") byId.set(p.id, p)
    if (batch.length < PER_PAGE) break
    await sleep(PAGE_DELAY_MS)
  }
  return [...byId.values()]
}
