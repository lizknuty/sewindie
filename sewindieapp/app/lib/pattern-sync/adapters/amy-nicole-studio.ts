import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Amy Nicole Studio (amynicolestudio.com) -- WooCommerce Store API.
//
// A mixed shop: sewing patterns plus a lot of merch (tees, mugs, totes, prints,
// pillows). Patterns are exactly the products filed under the "Patterns" or
// "Expansion Packs" categories; everything else is excluded. An item in
// "Expansion Packs" is an add-on. Titles carry a "PDF Pattern" / "PDF
// Expansion" tail we strip. The Store API here omits date_created (releaseDate
// null).
// ---------------------------------------------------------------------------

const BASE = "https://amynicolestudio.com"

const PATTERN_CATEGORY = /pattern|expansion/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

// "Colleen Cape Dress & Top PDF Pattern"           -> "Colleen Cape Dress & Top"
// "Audie Playdress PDF Expansion (Skirts Only!)"   -> "Audie Playdress (Skirts Only!)"
export function cleanAmyNicoleName(name: string): string {
  const cleaned = decodeEntities(name ?? "")
    .replace(/\s*\bpdf\s+(?:pattern|expansion)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || decodeEntities(name ?? "").trim()
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const amyNicoleStudioAdapter: DesignerAdapter = {
  slug: "amy-nicole-studio",
  label: "Amy Nicole Studio",
  matchHosts: ["amynicolestudio.com", "www.amynicolestudio.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const cats = categoryNames(product)
      if (!cats.some((c) => PATTERN_CATEGORY.test(c))) continue // skip merch

      const name = cleanAmyNicoleName(product.name ?? "")
      if (!name) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: cats.some((c) => /expansion/i.test(c)) ? "addon" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
