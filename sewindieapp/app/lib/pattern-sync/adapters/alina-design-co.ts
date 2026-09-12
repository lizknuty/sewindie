import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Alina Design Co (alinadesignco.com) -- WooCommerce Store API.
//
// Small catalogue of garment PDF patterns plus expansion packs and bundles.
// Categories drive the kind:
//   - "Expansion Packs" -> addon
//   - "Pattern Bundles" (or a "Bundle"/"Collection" name) -> bundle
//   - everything else -> pattern
// The only non-pattern is the Gift Card, which is excluded. The Store API here
// does not expose date_created, so releaseDate is null.
// ---------------------------------------------------------------------------

const BASE = "https://alinadesignco.com"

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

function classify(product: WooProduct, name: string): ScrapedPattern["kind"] {
  const cats = categoryNames(product)
  if (cats.some((c) => /expansion/i.test(c)) || /\bexpansion\b/i.test(name)) return "addon"
  if (cats.some((c) => /bundle/i.test(c)) || /\b(bundle|collection)\b/i.test(name)) return "bundle"
  return "pattern"
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const alinaDesignCoAdapter: DesignerAdapter = {
  slug: "alina-design-co",
  label: "Alina Design Co.",
  matchHosts: ["alinadesignco.com", "www.alinadesignco.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue
      if (/gift\s*card|gift\s*voucher/i.test(name)) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: classify(product, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
