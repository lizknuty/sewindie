import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Pattern Niche (patternniche.com) -- WooCommerce Store API. The catalogue is
// organised by garment/size categories, not a single "patterns" category, so we
// keep everything EXCEPT the non-pattern categories:
//   - "Cut Files"  -> SVG/cutting files, not sewing patterns
//   - "Gift Card"
//   - "Freebies"   -> a mix; the freebie cut files land here too, but the free
//                     SEWING patterns are also tagged with a garment category,
//                     so we only drop a Freebie when it has NO garment category.
// "Bundles" / "Custom Bundles" categories, and "(Bundle)"/"(Bundle3)" name
// suffixes, mark bundles. "(Youth)" is a real audience variant and is KEPT in
// the name so the youth version stays distinct from the adult one.
//
// The Store API here does not expose date_created, so releaseDate is null.
// Names are HTML-entity encoded and decoded. Identity is the product id.
// ---------------------------------------------------------------------------

const BASE = "https://patternniche.com"

const EXCLUDED_CATEGORY = /^(cut files|gift card)$/i
// Some non-pattern products (e.g. the store gift card) carry NO category at all,
// so a name-based guard backs up the category filter.
const EXCLUDED_NAME = /^gift card$|gift card|cut file/i
const GARMENT_CATEGORY = /tops|bottoms|dresses|sizing|gender neutral|outerwear|accessories/i
const FREEBIE_CATEGORY = /^freebies$/i
const BUNDLE_CATEGORY = /bundle/i
const BUNDLE_NAME = /\(bundle\d*\)|\bbundle\b/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c.name ?? "")
}

export const patternNicheAdapter: DesignerAdapter = {
  slug: "pattern-niche",
  label: "Pattern Niche",
  matchHosts: ["patternniche.com", "www.patternniche.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const cats = categoryNames(product)
      // Hard excludes: cut files, gift cards.
      if (cats.some((c) => EXCLUDED_CATEGORY.test(c))) continue
      // Freebies with no garment category are cut-file/printable freebies -> drop.
      if (cats.some((c) => FREEBIE_CATEGORY.test(c)) && !cats.some((c) => GARMENT_CATEGORY.test(c))) {
        continue
      }

      const name = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue
      if (EXCLUDED_NAME.test(name)) continue

      const isBundle = cats.some((c) => BUNDLE_CATEGORY.test(c)) || BUNDLE_NAME.test(name)
      const kind: ProductKind = isBundle ? "bundle" : "pattern"

      results.push({
        name,
        url: product.permalink ?? `${BASE}/?p=${product.id}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind,
        sourceId: String(product.id),
      })
    }
    return results
  },
}
