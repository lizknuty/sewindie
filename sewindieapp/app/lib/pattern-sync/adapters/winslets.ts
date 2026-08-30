import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Winslet's Patterns (winslets.com) -- Shopify.
//
// A large, clean catalogue: every product is typed by garment category (Dress,
// Top, Pants, Coord Set, ...) and is a PDF sewing pattern. The only non-pattern
// is the store gift card ("Sewing Gift Card from Winslet's"), excluded by name.
//
// Titles follow "<Garment> Sewing Pattern 'Name'" (the design name in single or
// curly quotes). We keep the full descriptive title as the display name but
// strip the boilerplate "Sewing Pattern" words for readability, leaving e.g.
// "Utility Mini Skirt 'Sabrina'". Release date from published_at.
// ---------------------------------------------------------------------------

const STORE = "https://winslets.com"

const GIFT_CARD = /gift card|gift voucher/i

// Drop the "Sewing Pattern" boilerplate while preserving garment + design name.
export function cleanWinsletsName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/\s*\bsewing pattern\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function isExcluded(product: ShopifyProduct): boolean {
  return GIFT_CARD.test(product.title) || GIFT_CARD.test(product.product_type ?? "")
}

export const winsletsAdapter: DesignerAdapter = {
  slug: "winslets",
  label: "Winslet's Patterns",
  matchHosts: ["winslets.com", "www.winslets.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products) {
      if (isExcluded(product)) continue
      const name = cleanWinsletsName(product.title)
      if (!name) continue

      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }

    return out
  },
}
