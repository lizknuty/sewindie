import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Below the Kōwhai (belowthekowhai.nz) -- WooCommerce Store API.
//
// A mixed shop selling fabric, linen, notions, embroidery and sewing patterns.
// The PDF sewing patterns are exactly the products filed under the "PDF
// Patterns" category. We deliberately exclude the "Projector Files" category:
// those are alternate-format duplicates of the same patterns and would double
// every design. Fabric / Linen / Notions / Remnants are excluded too.
// The Store API here omits date_created (releaseDate null).
// ---------------------------------------------------------------------------

const BASE = "https://belowthekowhai.nz"

const PDF_PATTERN_CATEGORY = /pdf\s*patterns?/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const belowTheKowhaiAdapter: DesignerAdapter = {
  slug: "below-the-kowhai",
  label: "Below the Kōwhai",
  matchHosts: ["belowthekowhai.nz", "www.belowthekowhai.nz"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!categoryNames(product).some((c) => PDF_PATTERN_CATEGORY.test(c))) continue // skip fabric/notions/projector

      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: /\bbundle\b/i.test(name) ? "bundle" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
