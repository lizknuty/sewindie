import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Pattern Sewciety (patternsewciety.com) -- WooCommerce.
//
// Small catalogue (~16), every product is a sewing pattern (categories are just
// "Patterns" / "Wedding/Evening Patterns"). No bundles/add-ons observed, but we
// still classify defensively by name. Names sometimes carry a trailing
// "Sewing Pattern" / "- PDF Pattern" which we strip.
// ---------------------------------------------------------------------------

const BASE = "https://patternsewciety.com"

export function cleanPatternSewcietyName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*(pdf|digital|printed)\b.*$/i, "")
    .replace(/\s*\b(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (/\bexpansion\b|\badd.?on\b/i.test(name)) return "addon"
  if (/\bbundle\b|\bcollection\b/i.test(name)) return "bundle"
  return "pattern"
}

export const patternSewcietyAdapter: DesignerAdapter = {
  slug: "pattern-sewciety",
  label: "Pattern Sewciety",
  matchHosts: ["patternsewciety.com", "www.patternsewciety.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const name = cleanPatternSewcietyName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
