import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Helen's Closet Patterns (helensclosetpatterns.com) -- Shopify.
//
// Small, clean store (~51). product_type here is a GARMENT CATEGORY
// ("Wovens" / "Knits"), NOT a kind, so we do not classify by type -- every
// listing is a pattern. We exclude only the gift card by name; the free
// "Lazo + Holmes Crossover Booklet (FREE)" is kept as a pattern.
// ---------------------------------------------------------------------------

const STORE = "https://helensclosetpatterns.com"

const EXCLUDE = /gift\s*card/i
const BUNDLE = /\b(?:bundle|pack)\b/i

// Names are already clean ("Holmes Dress"); just tidy the FREE marker/entities.
export function cleanHelensClosetName(title: string): string {
  return (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*\((?:FREE|free)\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const helensClosetAdapter: DesignerAdapter = {
  slug: "helens-closet",
  label: "Helen's Closet",
  matchHosts: ["helensclosetpatterns.com", "www.helensclosetpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const byId = new Map<string, ScrapedPattern>()

    for (const product of products as ShopifyProduct[]) {
      if (EXCLUDE.test(product.title)) continue
      const name = cleanHelensClosetName(product.title)
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
