import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Made for Mermaids (madeformermaids.com) -- WooCommerce.
//
// ~800 products (large catalogue: children's + women's + men's PDF patterns,
// heavy on collections/bundles). Category-driven classification. Exclude:
//   - "Cut files" / "Texas Cut Files" (machine SVG cut files, not sewing)
//   - gift cards / memberships
// Classify:
//   - "Bundles" category or name "Bundle" -> bundle
//   - everything else -> pattern (incl. "FREE PDF PATTERN-" craft items)
// Woo Store API omits date_created here.
// ---------------------------------------------------------------------------

const BASE = "https://www.madeformermaids.com"

export function cleanMermaidsName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/^\s*free\s+pdf\s+pattern\s*[-–—:]?\s*/i, "") // normalize freebie prefix
    .replace(/\s*[-–—|]\s*(pdf|printed)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isNonPattern(product: WooProduct): boolean {
  const cats = (product.categories ?? []).map((c) => (c?.name ?? "").toLowerCase())
  const name = decodeEntities(product.name ?? "").toLowerCase()
  if (cats.some((c) => /cut file/.test(c))) return true
  if (/gift card|gift voucher|membership/.test(name)) return true
  return false
}

function classify(product: WooProduct): ProductKind {
  const cats = (product.categories ?? []).map((c) => (c?.name ?? "").toLowerCase())
  const name = decodeEntities(product.name ?? "").toLowerCase()
  if (cats.some((c) => /^bundles$/.test(c)) || /\bbundle\b/.test(name)) return "bundle"
  return "pattern"
}

export const madeForMermaidsAdapter: DesignerAdapter = {
  slug: "made-for-mermaids",
  label: "Made for Mermaids",
  matchHosts: ["madeformermaids.com", "www.madeformermaids.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (isNonPattern(product)) continue
      const name = cleanMermaidsName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(product),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
