import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Paradise Patterns (paradisepatterns.com) -- Shopify.
//
// ~19 products, all product_type "Pattern". Clean single-line design names.
// Several are expansions ("... Expansion" / "Expansion Pack") -> addon.
// "FREE " prefix -> keep as pattern, strip marker.
// ---------------------------------------------------------------------------

const STORE = "https://paradisepatterns.com"

export function cleanParadiseName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/^\s*free\s+/i, "")
    .replace(/\s*[-–—|]\s*pdf\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/expansion|add.?on/.test(t)) return "addon"
  if (/\bbundle\b/.test(t)) return "bundle"
  return "pattern"
}

export const paradisePatternsAdapter: DesignerAdapter = {
  slug: "paradise-patterns",
  label: "Paradise Patterns",
  matchHosts: ["paradisepatterns.com", "www.paradisepatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      const name = cleanParadiseName(product.title)
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
