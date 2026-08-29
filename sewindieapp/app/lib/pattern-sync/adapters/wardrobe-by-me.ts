import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Wardrobe By Me
// ---------------------------------------------------------------------------
// A Danish pattern company on Shopify, reconciling against 108 existing rows.
// The public `/products.json` feed works with no auth. Verified shape (197
// products across two product_types):
//   products[].title        -> "Waistcoat sewing pattern for women"
//   products[].handle       -> slug for the product URL
//   products[].product_type -> "PDF Sewing pattern" (134) | "Paper sewing pattern" (63)
//   products[].published_at -> release date (116 distinct days -- trustworthy)
//   products[].images[0].src-> image URL
//
// Three decisions define this adapter.
//
//  1. PDF PRODUCTS ONLY; PAPER IS EXCLUDED. Every design is sold twice -- once
//     as a "PDF Sewing pattern" and once as a "Paper sewing pattern" -- as two
//     separate products distinguished by product_type, NOT by the title. A
//     pattern in SewIndie is a garment design, not a format SKU. Rather than
//     pair-and-collapse (the two products share no reliable handle or title
//     stem -- "Anna Shirt Sewing Pattern" vs "Anna Shirt Paper Pattern - Women's
//     sizes"), this adapter simply keeps the PDF product and drops paper
//     entirely. That is exactly the existing catalogue's own convention: of the
//     108 stored rows, 72 map to a PDF product and ZERO to a paper product.
//     Genuine paper-only designs (paper with no PDF at all) do not exist in the
//     catalogue -- every paper listing is a physical twin of a PDF design.
//
//  2. IDENTITY IS THE HANDLE, NOT THE FULL URL. All 108 existing rows are
//     stored under the collection path
//     /collections/sewing-patterns-wardrobebyme/products/<handle>, while the
//     canonical product URL is the bare /products/<handle> (the collection form
//     301-redirects to it). Storing new rows under the bare form would make
//     them fail a naive URL comparison against the old rows, so -- as with
//     Green Pepper and Grasser -- the trailing handle is identity. New rows are
//     written with the collection-independent bare /products/<handle>.
//
//  3. RELEASE DATE IS TRUSTED. Unlike stores migrated onto Shopify in one batch,
//     published_at here spreads across 116 distinct days for 134 products (max
//     3 on any day), so it is a real release date and is kept.
// ---------------------------------------------------------------------------

const STORE = "https://wardrobebyme.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// 1 page covers the current catalogue; 10 leaves room to grow while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

/** The PDF product_type; the "Paper sewing pattern" type is excluded -- see decision 1. */
const PDF_PRODUCT_TYPE = "pdf sewing pattern"

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string | null
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// The trailing handle: the last non-empty path segment, lower-cased. Stable
// across the collection path the existing rows use and the bare product path.
// See decision 2.
export function wardrobeByMeHandle(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const path = new URL(withScheme).pathname.replace(/\/+$/, "")
    const segment = path.split("/").filter(Boolean).pop()
    return segment ? segment.toLowerCase() : null
  } catch {
    return null
  }
}

/** The catalogue is patterns and pattern bundles only; no kits, fabric or merch. */
function classify(title: string): ProductKind {
  if (/\bbundles?\b/i.test(title)) return "bundle"
  if (/\badd-?ons?\b/i.test(title) || /\bexpansion\b/i.test(title)) return "addon"
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Wardrobe By Me returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const wardrobeByMeAdapter: DesignerAdapter = {
  slug: "wardrobe-by-me",
  label: "Wardrobe By Me",
  matchHosts: ["wardrobebyme.com", "www.wardrobebyme.com"],

  // Existing rows use the collection path, new rows use the bare path; the
  // handle is the only stable identity across both. See decision 2.
  identityKey(url) {
    return wardrobeByMeHandle(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    // Keep only the PDF products (decision 1). If the type name changes upstream
    // and nothing matches, fall back to everything rather than reporting an
    // empty catalogue -- but that would (deliberately) reintroduce paper, so it
    // is a loud failure mode the verify script guards against.
    const pdfOnly = products.filter((p) => (p.product_type ?? "").trim().toLowerCase() === PDF_PRODUCT_TYPE)
    const candidates = pdfOnly.length > 0 ? pdfOnly : products

    const results: ScrapedPattern[] = []

    for (const product of candidates) {
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null, // trustworthy here -- see decision 3
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
