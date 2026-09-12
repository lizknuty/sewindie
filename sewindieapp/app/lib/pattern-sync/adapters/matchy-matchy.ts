import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Matchy Matchy Sewing Club (matchymatchysewingclub.com) -- Shopify.
//
// ~876 products, but the store is mostly FABRIC + NOTIONS (thread, buttons,
// linen, cotton). Only product_type "Sewing Patterns" (42) are actual patterns.
// Keep ONLY that type. Titles carry a "PDF Sewing Pattern" tail and some a
// "FREE " prefix (keep as pattern, strip the marker).
//   - "Bundle" -> bundle
//   - "Expansion"/"Add-On" -> addon
//   - else -> pattern
// ---------------------------------------------------------------------------

const STORE = "https://matchymatchysewingclub.com"

export function cleanMatchyMatchyName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/^\s*free\s+/i, "") // drop leading FREE marker
    .replace(/\s*[-–—|]\s*(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s*\bpdf sewing pattern\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/\bbundle\b/.test(t)) return "bundle"
  if (/expansion|add.?on/.test(t)) return "addon"
  return "pattern"
}

export const matchyMatchyAdapter: DesignerAdapter = {
  slug: "matchy-matchy",
  label: "Matchy Matchy Sewing Club",
  matchHosts: ["matchymatchysewingclub.com", "www.matchymatchysewingclub.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      // Keep ONLY the "Sewing Patterns" product type -- everything else is
      // fabric / notions / haberdashery.
      if (!/^sewing patterns$/i.test(product.product_type ?? "")) continue

      const name = cleanMatchyMatchyName(product.title)
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
