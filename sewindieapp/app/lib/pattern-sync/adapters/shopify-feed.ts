// ---------------------------------------------------------------------------
// Shared Shopify products.json paginator.
//
// Every Shopify storefront exposes a public, unauthenticated JSON feed at
// `/products.json?limit=250&page=N`. This helper walks all pages and returns
// the raw products; each adapter supplies its own filter / clean / collapse
// logic on top. Older Shopify adapters inline this loop; new ones share this.
// ---------------------------------------------------------------------------

import { DEFAULT_USER_AGENT, sleep } from "./scrape-helpers"

export type ShopifyProduct = {
  id: number
  title: string
  handle: string
  product_type?: string
  published_at?: string | null
  created_at?: string | null
  vendor?: string
  tags?: string[]
  images?: Array<{ src?: string }>
}

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 200
const MAX_ATTEMPTS = 4
const RETRY_BASE_DELAY_MS = 600

// Fetch one feed page, retrying transient failures (5xx, 429, network/timeout).
// Shopify's edge intermittently throws 500/502 on the large product feed, so a
// single blip must not abort the whole sync. Real 4xx (except 429) fail fast.
async function fetchFeedPage(url: string): Promise<{ products?: ShopifyProduct[] }> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      if (res.ok) return (await res.json()) as { products?: ShopifyProduct[] }
      const transient = res.status === 429 || res.status >= 500
      lastError = new Error(`Shopify returned ${res.status} for ${url}`)
      if (!transient) throw lastError
    } catch (error) {
      lastError = error
    }
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BASE_DELAY_MS * attempt)
  }
  throw lastError instanceof Error ? lastError : new Error(`Shopify request failed for ${url}`)
}

// Fetch every product from a Shopify store's public JSON feed.
export async function fetchShopifyProducts(storeBase: string): Promise<ShopifyProduct[]> {
  const base = storeBase.replace(/\/$/, "")
  const all: ShopifyProduct[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/products.json?limit=${PER_PAGE}&page=${page}`
    const body = await fetchFeedPage(url)
    const batch = body.products ?? []
    all.push(...batch)
    if (batch.length < PER_PAGE) break
    await sleep(PAGE_DELAY_MS)
  }
  return all
}

// Canonical product URL for a Shopify handle.
export function shopifyProductUrl(storeBase: string, handle: string): string {
  return `${storeBase.replace(/\/$/, "")}/products/${handle}`
}
