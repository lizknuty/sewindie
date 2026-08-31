import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Nina Lee (ninalee.co.uk) -- Shopify.
//
// ~42 listings, all PDF sewing patterns, BUT each design is sold as TWO listings
// split by size range: "Dolores – PDF sewing pattern (sizes 6–20)" and
// "...(sizes 16–28)". Collapse the size twins by cleaned design name (first
// listing wins). ~25 designs after collapse.
//   - "Bundle" -> bundle
//   - "Expansion Pack" -> addon
//   - else -> pattern
// ---------------------------------------------------------------------------

const STORE = "https://www.ninalee.co.uk"

export function cleanNinaLeeName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/\s*[-–—]\s*pdf sewing pattern\b.*$/i, "") // drops "(sizes ...)" too
    .replace(/\s*[-–—]\s*pdf pattern\b.*$/i, "")
    .replace(/\s*\(sizes[^)]*\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(product: ShopifyProduct): ProductKind {
  const t = (product.title ?? "").toLowerCase()
  if (/\bbundle\b/.test(t)) return "bundle"
  if (/expansion/.test(t)) return "addon"
  return "pattern"
}

export const ninaLeeAdapter: DesignerAdapter = {
  slug: "nina-lee",
  label: "Nina Lee",
  matchHosts: ["ninalee.co.uk", "www.ninalee.co.uk"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products as ShopifyProduct[]) {
      const name = cleanNinaLeeName(product.title)
      if (!name) continue
      // Collapse size-range twins by cleaned name (first listing wins).
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

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
