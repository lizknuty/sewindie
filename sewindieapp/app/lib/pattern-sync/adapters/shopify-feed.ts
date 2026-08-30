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

// Fetch every product from a Shopify store's public JSON feed.
export async function fetchShopifyProducts(storeBase: string): Promise<ShopifyProduct[]> {
  const base = storeBase.replace(/\/$/, "")
  const all: ShopifyProduct[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/products.json?limit=${PER_PAGE}&page=${page}`
    const res = await fetch(url, {
      headers: { "User-Agent": DEFAULT_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`Shopify returned ${res.status} for ${url}`)
    const body = (await res.json()) as { products?: ShopifyProduct[] }
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
