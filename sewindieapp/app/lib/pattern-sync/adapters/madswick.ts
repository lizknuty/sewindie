import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Madswick (madswick.com) -- Shopify.
//
// ~25 products. product_type is a GARMENT category (dress/Blouse/Jacket/sleeve/
// Expansion) or empty -- NOT a kind. All titles carry a "| PDF" suffix. Classify
// by name/type:
//   - Gift Card, Sewing Planner        -> "other" (not a pattern)
//   - "Expansion" (name or type)       -> addon
//   - "Bundle"                         -> bundle
//   - everything else                  -> pattern
// ---------------------------------------------------------------------------

const STORE = "https://madswick.com"

export function cleanMadswickName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\s*\|\s*pdf\b.*$/i, "") // drop "| PDF ..." suffix
    .replace(/\s*[-–—]\s*(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  const type = (product.product_type ?? "").toLowerCase()
  if (/gift card|sewing planner/.test(t)) return "other"
  if (/expansion/.test(t) || /expansion/.test(type)) return "addon"
  if (/\bbundle\b/.test(t)) return "bundle"
  return "pattern"
}

export const madswickAdapter: DesignerAdapter = {
  slug: "madswick",
  label: "Madswick",
  matchHosts: ["madswick.com", "www.madswick.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      const name = cleanMadswickName(product.title)
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
