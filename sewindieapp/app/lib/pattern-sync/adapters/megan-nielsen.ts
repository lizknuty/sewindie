import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Megan Nielsen (megannielsen.com) -- Shopify.
//
// ~149 products. product_type IS meaningful here: keep only "Sewing Patterns"
// and "Free Sewing Patterns". Exclude "Wholesale Sewing Patterns" (B2B dupes of
// the same designs), "Accessories", "Notions", "Books", "Gift Card".
//   - "Add On" / "Expansion"  -> addon
//   - "Bundle"                -> bundle
// NB "<Design> Curve" is a distinct plus-size design and is KEPT separate from
// its straight-size sibling (they are sold as separate products).
// ---------------------------------------------------------------------------

const STORE = "https://megannielsen.com"

const KEEP_TYPE = /^(sewing patterns|free sewing patterns)$/i

export function cleanMeganNielsenName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—]\s*(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\bsewing pattern\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  const n = name.toLowerCase()
  if (/\bbundle\b/.test(n)) return "bundle"
  if (/\badd[\s-]?on\b|\bexpansion\b/.test(n)) return "addon"
  return "pattern"
}

export const meganNielsenAdapter: DesignerAdapter = {
  slug: "megan-nielsen",
  label: "Megan Nielsen",
  matchHosts: ["megannielsen.com", "www.megannielsen.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (!KEEP_TYPE.test(product.product_type ?? "")) continue // skip wholesale/accessories/notions/books
      const name = cleanMeganNielsenName(product.title)
      if (!name) continue
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
