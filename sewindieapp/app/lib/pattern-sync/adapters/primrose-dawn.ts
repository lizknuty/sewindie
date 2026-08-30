import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Primrose Dawn (primrosedawn.com) -- WooCommerce Store API. A lingerie/
// underwear pattern house; almost everything is a "PDF sewing pattern".
//
//  - Names carry a ": <short description>" marketing suffix
//    ("Chiara Bralette PDF sewing pattern: wireless soft cup bra") -> we cut at
//    the ":" and strip the "PDF sewing pattern" descriptor to get "Chiara
//    Bralette". Body-part/garment words stay; the Mastectomy Pillow is a real
//    sewing pattern and is KEPT.
//  - EXCLUDE the "Planners/Printables" category (not garment patterns).
//  - Woo product type "woosb" (WooCommerce Smart Bundles) == a bundle; also the
//    "Pattern Bundles" category. Flagged as bundle.
//
// Store API does not expose date_created here, so releaseDate is null. Names are
// HTML-entity decoded. Identity is the product id.
// ---------------------------------------------------------------------------

const BASE = "https://primrosedawn.com"

const EXCLUDED_CATEGORY = /planners|printables/i
const BUNDLE_CATEGORY = /bundle/i

function categoryNames(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c.name ?? "")
}

// "Chiara Bralette PDF sewing pattern: wireless soft cup" -> "Chiara Bralette"
export function cleanPrimroseName(rawName: string): string {
  let t = decodeEntities((rawName ?? "").replace(/\s+/g, " ").trim())
  // Drop the ": marketing description" tail.
  t = t.split(":")[0].trim()
  // Strip the "(PDF )sewing pattern" descriptor wherever it sits at the end.
  t = t.replace(/\s*[-–]?\s*(?:pdf\s+)?sewing\s+pattern\s*$/i, "").trim()
  return t || decodeEntities((rawName ?? "").trim())
}

export const primroseDawnAdapter: DesignerAdapter = {
  slug: "primrose-dawn",
  label: "Primrose Dawn",
  matchHosts: ["primrosedawn.com", "www.primrosedawn.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      const cats = categoryNames(product)
      if (cats.some((c) => EXCLUDED_CATEGORY.test(c))) continue

      const name = cleanPrimroseName(product.name ?? "")
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const isBundle = (product.type ?? "").toLowerCase() === "woosb" || cats.some((c) => BUNDLE_CATEGORY.test(c))
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
