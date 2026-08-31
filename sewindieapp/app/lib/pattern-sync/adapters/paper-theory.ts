import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Paper Theory Patterns (papertheorypatterns.com) -- Shopify.
//
// ~13 products. Mostly untyped PDF patterns. Exclude:
//   - "Digital Gift Card" (type "Gift Cards")
//   - "Price test product" (leftover test item)
//   - "Make a Zadie Jumpsuit Workshop" (a workshop, not a pattern)
// "Zadie Dress Expansion" -> addon. Strip "PDF Pattern"/"PDF pattern" tail.
// ---------------------------------------------------------------------------

const STORE = "https://papertheorypatterns.com"

export function cleanPaperTheoryName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\s*[-–—|]\s*pdf\b.*$/i, "")
    .replace(/\s*\bpdf\s+pattern\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isNonPattern(product: ShopifyProduct): boolean {
  const t = (product.title ?? "").toLowerCase()
  const type = (product.product_type ?? "").toLowerCase()
  if (/gift card/.test(t) || /gift card/.test(type)) return true
  if (/price test|test product/.test(t)) return true
  if (/workshop|class\b/.test(t)) return true
  return false
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/\bbundle\b/.test(t)) return "bundle"
  if (/expansion/.test(t)) return "addon"
  return "pattern"
}

export const paperTheoryAdapter: DesignerAdapter = {
  slug: "paper-theory",
  label: "Paper Theory Patterns",
  matchHosts: ["papertheorypatterns.com", "www.papertheorypatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (isNonPattern(product)) continue
      const name = cleanPaperTheoryName(product.title)
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
