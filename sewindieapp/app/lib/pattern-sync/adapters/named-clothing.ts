import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Named Clothing (namedclothing.com) -- Shopify.
//
// ~92 products. product_type is a GARMENT category (Dresses & jumpsuits, Tops,
// Bottoms, Jackets & coats, Accessories) -- NOT a kind. Nearly all are patterns.
// Exclude:
//   - "Gift card"
//   - "Building the Pattern" (their sewing BOOK)
// Design names are clean ("Aaria mini wrap dress"); no tail to strip.
//   - "Bundle" -> bundle
// ---------------------------------------------------------------------------

const STORE = "https://www.namedclothing.com"

export function cleanNamedName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\s*[-–—|]\s*(pdf|printed)\b.*$/i, "")
    .replace(/\s*[-–—|]\s*sewing pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isNonPattern(product: ShopifyProduct): boolean {
  const t = (product.title ?? "").toLowerCase()
  const type = (product.product_type ?? "").toLowerCase()
  if (/gift card/.test(t)) return true
  if (/building the pattern/.test(t)) return true // their book
  if (/gift/.test(type)) return true
  return false
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/\bbundle\b/.test(t)) return "bundle"
  return "pattern"
}

export const namedClothingAdapter: DesignerAdapter = {
  slug: "named-clothing",
  label: "Named Clothing",
  matchHosts: ["namedclothing.com", "www.namedclothing.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (isNonPattern(product)) continue
      const name = cleanNamedName(product.title)
      if (!name) continue
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(product),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
