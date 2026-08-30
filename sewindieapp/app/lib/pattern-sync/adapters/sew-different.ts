import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Sew Different (sewdifferent.co.uk) -- WooCommerce Store API.
//
// A mixed shop: sewing patterns AND fabric, kits, events. Patterns are exactly
// the products filed under a category whose name contains "pattern" ("Pattern
// Shop", "Quick Makes Patterns", "Children's patterns"); everything in "Fabric
// Shop", "100% Cotton", "Events", etc. is excluded. The home page sits behind a
// Cloudflare challenge, but the Store API JSON endpoint is not challenged.
//
// The Store API here does not expose date_created, so releaseDate is null.
// Identity is the Woo product id.
// ---------------------------------------------------------------------------

const BASE = "https://sewdifferent.co.uk"

const PATTERN_CATEGORY = /pattern/i

function inPatternCategory(product: WooProduct): boolean {
  return (product.categories ?? []).some((c) => PATTERN_CATEGORY.test(c?.name ?? ""))
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const sewDifferentAdapter: DesignerAdapter = {
  slug: "sew-different",
  label: "Sew Different",
  matchHosts: ["sewdifferent.co.uk", "www.sewdifferent.co.uk"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!inPatternCategory(product)) continue
      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
