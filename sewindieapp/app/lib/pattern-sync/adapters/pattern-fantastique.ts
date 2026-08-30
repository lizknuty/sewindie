import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Pattern Fantastique (patternfantastique.com)
// ---------------------------------------------------------------------------
// A small Shopify store (~19 products). product_type is inconsistent ("Jacket
// Pattern.", "Hat", "dress", "T-shirt, Tee shirt, Dress"), so it is NOT used to
// filter; instead everything is a pattern EXCEPT:
//   - "... coming soon" placeholder listings, and
//   - "Makers Kits" / Kit products ("Lucent Visor - Makers Kits").
//
// Names carry a "- Sewing Pattern" tail (sometimes glued: "Magda Dress-"). One
// design is listed twice ("Falda Jacket" AND "Falda Jacket - Sewing Pattern");
// after stripping the tail both collapse to one, and we prefer the listing that
// carried the "Sewing Pattern" suffix (the canonical pattern product).
// published_at is a real release date, kept.
// ---------------------------------------------------------------------------

const STORE = "https://www.patternfantastique.com"

const COMING_SOON = /\bcoming soon\b/i
const KIT = /\b(makers?\s+kits?|kit)\b/i
// Trailing "- Sewing Pattern" (dash optional/glued, e.g. "Magda Dress-").
const PATTERN_TAIL = /\s*[-–]\s*sewing\s+pattern\s*$/i

// Clean a Pattern Fantastique title to its design name. Exported for tests.
export function cleanPatternFantastiqueName(title: string): string {
  return (title ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(PATTERN_TAIL, "")
    .trim()
}

export const patternFantastiqueAdapter: DesignerAdapter = {
  slug: "pattern-fantastique",
  label: "Pattern Fantastique",
  matchHosts: ["patternfantastique.com", "www.patternfantastique.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // Collapse by cleaned name; prefer the "- Sewing Pattern" listing.
    const byKey = new Map<string, { product: ShopifyProduct; name: string; suffixed: boolean }>()
    for (const product of products) {
      const title = (product.title ?? "").trim()
      if (!title || COMING_SOON.test(title)) continue
      if (KIT.test(product.product_type ?? "") || KIT.test(title)) continue

      const name = cleanPatternFantastiqueName(title)
      if (!name) continue
      const key = name.toLowerCase()
      const suffixed = PATTERN_TAIL.test(title)
      const existing = byKey.get(key)
      // Keep the suffixed (canonical pattern) listing when duplicated.
      if (!existing || (suffixed && !existing.suffixed)) {
        byKey.set(key, { product, name, suffixed })
      }
    }

    return [...byKey.values()].map(({ product, name }) => ({
      name,
      url: shopifyProductUrl(STORE, product.handle),
      imageUrl: product.images?.[0]?.src ?? null,
      releaseDate: product.published_at ?? null,
      kind: "pattern" as const,
      sourceId: String(product.id),
    }))
  },
}
