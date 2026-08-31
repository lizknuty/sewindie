import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Anne Kerdiles Couture (annekerdilescouture.com) -- WooCommerce Store API.
//
// A French mixed shop: sewing patterns ("Patrons PDF", "Patrons de couture")
// alongside stationery ("Papeterie"), stickers, and books ("Livres"). Patterns
// are exactly the products in a category whose name contains "patron";
// everything else is excluded. Garment categories (Haut, Robe, Bas, Veste)
// overlap the pattern categories, so the "patron" filter is what discriminates.
// "Pack ..." names are bundles. The Store API here omits date_created.
// ---------------------------------------------------------------------------

const BASE = "https://www.annekerdilescouture.com"

const PATTERN_CATEGORY = /patron/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const anneKerdilesAdapter: DesignerAdapter = {
  slug: "anne-kerdiles",
  label: "Anne Kerdiles Couture",
  matchHosts: ["annekerdilescouture.com", "www.annekerdilescouture.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!categoryNames(product).some((c) => PATTERN_CATEGORY.test(c))) continue // skip stickers/stationery/books

      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: /\b(pack|bundle)\b/i.test(name) ? "bundle" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
