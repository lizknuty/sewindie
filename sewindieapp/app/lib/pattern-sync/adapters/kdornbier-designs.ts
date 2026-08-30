import type { DesignerAdapter, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Kdornbier Designs
// ---------------------------------------------------------------------------
// A Shopify shop that sells BOTH sewing patterns and machine-embroidery
// patterns, plus non-pattern goods. Verified product_type distribution:
//   "PDF Sewing Pattern"     (~13)  -> pattern
//   "PDF Embroidery Pattern" (~12)  -> pattern (embroidery designs are patterns)
//   "Embroidery Kit" / "Mug" / "Hat" / "Sewing Guide" / "Gift Card" -> excluded
// So the filter is: product_type ends in "Pattern" (case-insensitive). Both a
// PDF sewing pattern and a PDF embroidery pattern count; kits, physical goods,
// guides and gift cards do not.
//
// Titles are already clean brand names ("Sadie Romper", "Floral Alphabet")
// often with a trailing " - PDF Sewing Pattern" / " PDF Embroidery Pattern"
// descriptor, which we strip. Identity is the Shopify numeric id. published_at
// is a real staggered release date on this store and is kept.
// ---------------------------------------------------------------------------

const STORE = "https://kdornbierdesigns.com"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const PER_PAGE = 250
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 200

// product_type whose value ends with "pattern" -> a (sewing or embroidery)
// pattern. Excludes "Embroidery Kit", "Sewing Guide", "Mug", "Gift Card", etc.
const PATTERN_TYPE = /pattern\s*$/i

// Trailing format descriptor. Sewing patterns have clean names ("Avery Pencil
// Skirt"); embroidery patterns append a "(Digital|PDF) <Embroidery|Needle
// Painting> Pattern" descriptor ("Cable Knit Socks Digital Embroidery Pattern"
// -> "Cable Knit Socks"). Strip either form; both product types are patterns.
const FORMAT_TAIL = /\s*[-–]?\s*(?:pdf|digital)\s+(?:sewing|embroidery|needle\s+painting)\s+pattern\s*$/i

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function cleanKdornbierName(rawTitle: string): string {
  const name = (rawTitle ?? "").replace(/\s+/g, " ").trim().replace(FORMAT_TAIL, "").trim()
  return name || (rawTitle ?? "").trim()
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Kdornbier returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const kdornbierDesignsAdapter: DesignerAdapter = {
  slug: "kdornbier-designs",
  label: "Kdornbier Designs",
  matchHosts: ["kdornbierdesigns.com", "www.kdornbierdesigns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const results: ScrapedPattern[] = []
    for (const product of products) {
      const type = (product.product_type ?? "").trim()
      if (!PATTERN_TYPE.test(type)) continue

      const name = cleanKdornbierName(product.title ?? "")
      if (!name) continue

      results.push({
        name,
        url: `${STORE}/products/${(product.handle ?? "").trim()}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        // Both "PDF Sewing Pattern" and "PDF Embroidery Pattern" are patterns.
        kind: "pattern",
        sourceId: String(product.id),
      })
    }
    return results
  },
}
