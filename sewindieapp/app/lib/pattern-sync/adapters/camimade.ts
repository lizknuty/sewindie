import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Camimade (camimade.com) -- Shopify.
//
// Small, clean catalogue (~15). Every product is untyped (product_type empty)
// and is a sewing pattern, named "<description> pattern - <CODE NAME>", e.g.
//   "Denim chore jacket pattern - VILLERS"
//   "Balloon sleeve t-shirt for babies - NUAGE MINI"
// We keep the full descriptive title but drop the standalone " pattern" word
// for readability. The only expected non-pattern would be a gift card.
// ---------------------------------------------------------------------------

const STORE = "https://camimade.com"

const NON_PATTERN_TITLE = /\bgift\s*cards?\b|carte cadeau/i
const BUNDLE_TITLE = /\b(?:bundle|pack|lot)\b/i

export function cleanCamimadeName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/\s+\bpattern\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function classify(title: string): ProductKind {
  if (NON_PATTERN_TITLE.test(title)) return "other"
  if (BUNDLE_TITLE.test(title)) return "bundle"
  return "pattern"
}

export const camimadeAdapter: DesignerAdapter = {
  slug: "camimade",
  label: "Camimade",
  matchHosts: ["camimade.com", "www.camimade.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (NON_PATTERN_TITLE.test(product.title)) continue
      const name = cleanCamimadeName(product.title)
      if (!name) continue

      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(product.title),
        sourceId: String(product.id),
      })
    }

    return out
  },
}
