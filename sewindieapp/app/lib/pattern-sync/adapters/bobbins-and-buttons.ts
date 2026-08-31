import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Bobbins and Buttons (bobbinsnbuttons.co.uk) -- WooCommerce Store API.
//
// A large mixed shop (~370 products): mostly fabric, haberdashery, kits and
// in-person workshops, plus the designer's own PDF sewing patterns. The
// patterns are the products filed under the "Sewing Patterns" category. We
// exclude everything else (fabric/notions/kits/workshops) and also skip an
// "OLD PDF" category (superseded duplicate listings) and any workshop/class or
// gift-voucher items that happen to be cross-filed. Store API omits
// date_created here (releaseDate null).
// ---------------------------------------------------------------------------

const BASE = "https://www.bobbinsnbuttons.co.uk"

const SEWING_PATTERN_CATEGORY = /^sewing patterns$/i
const OLD_PDF_CATEGORY = /old\s*pdf/i
const NON_PATTERN_NAME = /\b(?:workshop|class|course|voucher|gift card|kit)\b/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const bobbinsAndButtonsAdapter: DesignerAdapter = {
  slug: "bobbins-and-buttons",
  label: "Bobbins and Buttons",
  matchHosts: ["bobbinsnbuttons.co.uk", "www.bobbinsnbuttons.co.uk"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const cats = categoryNames(product)
      if (!cats.some((c) => SEWING_PATTERN_CATEGORY.test(c))) continue // keep only sewing patterns
      if (cats.some((c) => OLD_PDF_CATEGORY.test(c))) continue // superseded duplicates

      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name || NON_PATTERN_NAME.test(name)) continue

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
