import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Jennuine Design (ajennuinelife.com) -- WooCommerce.
//
// ~83 products, children's/adult PDF sewing patterns. Categories are AGE/GARMENT
// groups (Girls/Children/Teen/Tops/Dresses...), NOT a product kind -- so classify
// by NAME:
//   - "Bundle"                -> bundle (there are many)
//   - "Expansion" / "Add On"  -> addon
//   - everything else         -> pattern
// "Big & Little <X>" and "Adult <X>" are distinct products; keep them separate.
// Store API omits date_created.
// ---------------------------------------------------------------------------

const BASE = "https://www.ajennuinelife.com"

export function cleanJennuineName(rawName: string): string {
  return decodeEntities(rawName ?? "")
    .replace(/\s*[-–—|]\s*(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  const n = name.toLowerCase()
  if (/\bbundle\b/.test(n)) return "bundle"
  if (/\bexpansion\b|\badd[\s-]?on\b/.test(n)) return "addon"
  return "pattern"
}

export const jennuineDesignAdapter: DesignerAdapter = {
  slug: "jennuine-design",
  label: "Jennuine Design",
  matchHosts: ["ajennuinelife.com", "www.ajennuinelife.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const name = cleanJennuineName(product.name ?? "")
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
