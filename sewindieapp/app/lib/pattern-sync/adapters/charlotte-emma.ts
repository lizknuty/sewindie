import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Charlotte Emma Patterns (charlotteemmapatterns.com) -- WooCommerce Store API.
//
// A small catalogue of PDF sewing patterns organised by garment categories
// (Knit / Woven / Tops / Dresses / Outerwear / Hats / Accessories). Every
// product is a pattern; only obvious non-patterns (gift cards) are excluded as
// a safeguard. A "Set of ... Patterns" product is flagged as a bundle. The
// Store API here does not expose date_created, so releaseDate is null.
// ---------------------------------------------------------------------------

const BASE = "https://charlotteemmapatterns.com"

const EXCLUDED_NAME = /gift card|gift voucher/i
// "Stitch Advent Set of Festive Patterns" is a multi-pattern bundle; a normal
// pattern name ("Clove Vest") is not. Avoid matching a bare plural "patterns".
const BUNDLE = /\bset of\b|\bbundle\b/i

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const charlotteEmmaAdapter: DesignerAdapter = {
  slug: "charlotte-emma",
  label: "Charlotte Emma Patterns",
  matchHosts: ["charlotteemmapatterns.com", "www.charlotteemmapatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name || EXCLUDED_NAME.test(name)) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: BUNDLE.test(name) ? "bundle" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
