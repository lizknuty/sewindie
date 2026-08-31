import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Heidi and Finn (heidiandfinn.com) -- Shopify.
//
// A big mixed store (~1500 products): mostly Fabric, finished Cuddle Dolls,
// snack bags, ornaments, etc. Only the "PDF pattern" (and stray "Sewing
// pattern") product_types are actual sewing patterns (~292). Everything else
// is excluded by type.
// ---------------------------------------------------------------------------

const STORE = "https://heidiandfinn.com"

const PATTERN_TYPE = /pdf pattern|sewing pattern/i
const BUNDLE = /\b(?:bundle|pack|set)\b/i

// Drop the "PDF …pattern" boilerplate tail from names.
export function cleanHeidiFinnName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—,]?\s*pdf (?:sewing )?pattern\b.*$/i, " ")
    .replace(/\s*[-–—]\s*pdf\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const heidiAndFinnAdapter: DesignerAdapter = {
  slug: "heidi-and-finn",
  label: "Heidi and Finn",
  matchHosts: ["heidiandfinn.com", "www.heidiandfinn.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const byId = new Map<string, ScrapedPattern>()

    for (const product of products as ShopifyProduct[]) {
      if (!PATTERN_TYPE.test(product.product_type ?? "")) continue
      const name = cleanHeidiFinnName(product.title)
      if (!name) continue
      const id = String(product.id)
      if (byId.has(id)) continue

      byId.set(id, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: id,
      })
    }

    return [...byId.values()]
  },
}
