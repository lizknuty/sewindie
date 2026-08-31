import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { decodeEntities } from "./woo-store"
import { cptToPattern, fetchWpCptProducts, type WpCptProduct } from "./wp-cpt-store"

// ---------------------------------------------------------------------------
// Orageuse (orageuse.com) -- WordPress/WooCommerce, FRENCH.
//
// The WC Store API is disabled here (404), but the "product" custom post type
// is exposed via the core WP REST API, so this adapter uses the shared
// wp-cpt-store helper instead of woo-store.
//
// ~18 products. French garment names like "Top Laurier", "Robe Bristol",
// "Combinaison Copenhague". A couple are lining/sleeve add-on kits
// ("Kit doublure Londres", "Kit manches Rome") -> addon. One "DIY - étole ..."
// is still a (free) pattern. Names carry HTML entities (&#038; etc.) to decode.
// ---------------------------------------------------------------------------

const BASE = "https://orageuse.com"

export function cleanOrageuseName(rawTitle: string): string {
  return decodeEntities(rawTitle)
    .replace(/^DIY\s*[-–—]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string, _product: WpCptProduct): ProductKind {
  // Lining/sleeve "kits" are pattern add-ons, not standalone garments.
  if (/^kit\b|\bexpansion\b|\badd.?on\b/i.test(name)) return "addon"
  if (/\bbundle\b|\blot\b|\bpack\b/i.test(name)) return "bundle"
  return "pattern"
}

export const orageuseAdapter: DesignerAdapter = {
  slug: "orageuse",
  label: "Orageuse",
  matchHosts: ["orageuse.com", "www.orageuse.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWpCptProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const pattern = cptToPattern(BASE, product, { cleanName: cleanOrageuseName, classify })
      if (pattern) results.push(pattern)
    }

    return results
  },
}
