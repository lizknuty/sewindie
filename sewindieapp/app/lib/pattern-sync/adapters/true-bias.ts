import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// True Bias (truebias.com) -- Shopify.
//
// product_type here is a SIZE RANGE, not a category: "Size 0-18", "Size 14-32",
// "Size 2T-10", etc. Many designs are sold as separate products per size range
// (e.g. a "Size 0-18" listing and a "Size 14-32" listing of the same pattern),
// so 70 listings collapse to ~41 distinct designs. We collapse by the cleaned
// title (identical across size-range listings) and keep the first listing as
// canonical. The lone "Gift Cards" product_type is excluded.
//
// Titles are already clean design names ("Ogden Cami", "Shelby Dress &
// Romper"); no size text appears in the title itself. Release date from
// published_at.
// ---------------------------------------------------------------------------

const STORE = "https://truebias.com"

const GIFT = /gift\s*card/i

// Design identity for collapsing size-range duplicate listings.
export function trueBiasKey(title: string): string {
  return cleanTrueBiasName(title).toLowerCase()
}

// Titles are clean design names; just tidy whitespace and any trailing
// "Sewing Pattern"/"PDF Pattern" boilerplate if present.
export function cleanTrueBiasName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/\s*\b(?:pdf\s+)?sewing pattern\b\s*/gi, " ")
    .replace(/\s*\bpdf pattern\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function isExcluded(product: ShopifyProduct): boolean {
  return GIFT.test(product.product_type ?? "") || GIFT.test(product.title)
}

export const trueBiasAdapter: DesignerAdapter = {
  slug: "true-bias",
  label: "True Bias",
  matchHosts: ["truebias.com", "www.truebias.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const byKey = new Map<string, ScrapedPattern>()

    for (const product of products) {
      if (isExcluded(product)) continue
      const name = cleanTrueBiasName(product.title)
      if (!name) continue
      const key = trueBiasKey(product.title)
      if (byKey.has(key)) continue // first size-range listing wins as canonical

      byKey.set(key, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }

    return [...byKey.values()]
  },
}
