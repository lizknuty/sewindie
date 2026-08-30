import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Pattern Emporium (patternemporium.com) -- Shopify.
//
// The whole store is PDF sewing patterns; product_type is the GARMENT category
// ("Womens Top", "Girls Skirt", "Dress", ...) rather than a "pattern" flag, so
// we treat every product as a pattern EXCEPT the store gift card (type/title
// "Gift Card"). Titles follow a "<Name> | <descriptor> PDF Sewing Pattern"
// house style -> keep the part before the "|" and strip the format tail.
// Release date from published_at.
// ---------------------------------------------------------------------------

const STORE = "https://patternemporium.com"

const GIFT_CARD = /gift\s*card/i

// "Just Between Us | Woven Top PDF Sewing Pattern" -> take the name before "|".
// No pipe: strip the trailing "PDF Sewing Pattern" descriptor instead.
export function cleanPatternEmporiumName(title: string): string {
  const raw = (title ?? "").replace(/\s+/g, " ").trim()
  // Preferred: the design name is the segment before the first "|".
  const beforePipe = raw.split("|")[0]?.trim()
  if (beforePipe && beforePipe.toLowerCase() !== raw.toLowerCase()) return beforePipe
  // No pipe: strip a trailing "... PDF Sewing Pattern" descriptor.
  return raw.replace(/\s*\bpdf sewing pattern\s*$/i, "").trim() || raw
}

function isGiftCard(product: ShopifyProduct): boolean {
  return GIFT_CARD.test(product.product_type ?? "") || GIFT_CARD.test(product.title ?? "")
}

export const patternEmporiumAdapter: DesignerAdapter = {
  slug: "pattern-emporium",
  label: "Pattern Emporium",
  matchHosts: ["patternemporium.com", "www.patternemporium.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (isGiftCard(product)) continue
      const name = cleanPatternEmporiumName(product.title)
      if (!name) continue
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
