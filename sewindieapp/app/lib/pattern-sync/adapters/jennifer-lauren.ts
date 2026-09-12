import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Jennifer Lauren Handmade (jenniferlaurenhandmade.store) -- WooCommerce.
//
// ~50 products, all garment sewing patterns. Categories drive classification:
//   - "Expansion Packs" / name "Expansion Pack" -> addon
//   - "Bundles" / name "Bundle"                 -> bundle
//   - "Free Downloads"                          -> pattern (free)
// Titles carry a leading "The " on many designs; keep it (it's part of the
// brand's design names, e.g. "The Emmie Tee"). Store API omits date_created.
// ---------------------------------------------------------------------------

const BASE = "https://jenniferlaurenhandmade.store"

export function cleanJenniferLaurenName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*(pdf|paper|printed)\b.*$/i, "")
    .replace(/\s*[-–—|]\s*(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(product: WooProduct): ProductKind {
  const cats = (product.categories ?? []).map((c) => (c?.name ?? "").toLowerCase())
  const name = decodeEntities(product.name ?? "").toLowerCase()
  if (cats.some((c) => /expansion/.test(c)) || /expansion pack/.test(name)) return "addon"
  if (cats.some((c) => /bundle/.test(c)) || /\bbundle\b/.test(name)) return "bundle"
  return "pattern"
}

export const jenniferLaurenAdapter: DesignerAdapter = {
  slug: "jennifer-lauren",
  label: "Jennifer Lauren Handmade",
  matchHosts: ["jenniferlaurenhandmade.store", "www.jenniferlaurenhandmade.store"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const name = cleanJenniferLaurenName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(product),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
