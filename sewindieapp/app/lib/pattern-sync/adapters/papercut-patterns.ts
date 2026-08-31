import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Papercut Patterns (papercutpatterns.com) -- Shopify.
//
// ~70 products. product_type is a GARMENT category (Dresses, Pants, tops,
// Jackets and Coats, Jumpsuits, swimwear) or empty -- NOT a kind. Nearly all are
// patterns. Many titles carry a trailing " PDF". Exclude only "Gift Card"
// (type "Gift Cards").
//   - "Bundle" / "Pack" -> bundle
//   - "Expansion"/"Add-On" -> addon
// ---------------------------------------------------------------------------

const STORE = "https://papercutpatterns.com"

export function cleanPapercutName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\s*[-–—|]\s*pdf\b.*$/i, "")
    .replace(/\s*\bpdf\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isNonPattern(product: ShopifyProduct): boolean {
  const t = (product.title ?? "").toLowerCase()
  const type = (product.product_type ?? "").toLowerCase()
  return /gift card/.test(t) || /gift/.test(type)
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/expansion|add.?on/.test(t)) return "addon"
  if (/\bbundle\b|\bpack\b/.test(t)) return "bundle"
  return "pattern"
}

export const papercutPatternsAdapter: DesignerAdapter = {
  slug: "papercut-patterns",
  label: "Papercut Patterns",
  matchHosts: ["papercutpatterns.com", "www.papercutpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (isNonPattern(product)) continue
      const name = cleanPapercutName(product.title)
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
