import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"
import { decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Bella Loves Patterns (bellalovespatterns.com) -- Shopify.
//
// Clean catalogue: every product is a garment-typed PDF sewing pattern (Tops,
// Dresses, Coats, Trousers, Skirts, Blazers & Jackets). Titles are upper-cased
// with a "– PDF SEWING PATTERN" tail and occasional double spaces we tidy.
// ---------------------------------------------------------------------------

const BASE = "https://bellalovespatterns.com"

// "RUPERT DOUBLE-FACED COAT – PDF SEWING PATTERN" -> "RUPERT DOUBLE-FACED COAT"
export function cleanBellaLovesName(title: string): string {
  const cleaned = decodeEntities(title ?? "")
    .replace(/\s*[-–—]\s*pdf\s+sewing\s+patterns?\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || decodeEntities(title ?? "").trim()
}

function firstImage(product: ShopifyProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const bellaLovesPatternsAdapter: DesignerAdapter = {
  slug: "bella-loves-patterns",
  label: "Bella Loves Patterns",
  matchHosts: ["bellalovespatterns.com", "www.bellalovespatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (/gift/i.test(product.product_type ?? "") || /gift card/i.test(product.title ?? "")) continue

      const name = cleanBellaLovesName(product.title ?? "")
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(BASE, product.handle),
        imageUrl: firstImage(product),
        releaseDate: product.published_at ?? product.created_at ?? null,
        kind: /\bbundle\b/i.test(name) ? "bundle" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
