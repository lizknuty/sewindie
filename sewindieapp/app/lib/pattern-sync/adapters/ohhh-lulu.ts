import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Ohhh Lulu (ohhhlululingerie.com) -- WooCommerce. Lingerie sewing patterns.
//
// ~55 products across garment categories (Knickers, Bras, Bodysuits, etc.).
// Design names often omit the word "pattern" (e.g. "The Cedar Bodysuit"), so do
// NOT filter by the word "pattern" -- classify by name/category instead.
// Exclude non-patterns:
//   - "Supplies Checklist" / "Supplies"
//   - standalone tutorials ("... Tutorial") that are NOT add-ons
// Classify:
//   - "Add-On" / "Expansion" (name) -> addon (kept even if labelled Tutorial)
//   - "Pattern Bundles" category / name "Bundle" -> bundle
//   - else -> pattern (incl. free patterns & templates)
// Woo Store API omits date_created here.
// ---------------------------------------------------------------------------

const BASE = "https://www.ohhhlululingerie.com"

export function cleanOhhhLuluName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*(pdf|digital|printed)\b.*$/i, "")
    .replace(/\s*\b(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s*\bdigital\s+pattern\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isAddon(name: string): boolean {
  return /add.?on|expansion/.test(name)
}

function isNonPattern(product: WooProduct): boolean {
  const name = decodeEntities(product.name ?? "").toLowerCase()
  if (/supplies|checklist/.test(name)) return true
  if (/\btutorial\b/.test(name) && !isAddon(name)) return true
  return false
}

function classify(product: WooProduct): ProductKind {
  const cats = (product.categories ?? []).map((c) => (c?.name ?? "").toLowerCase())
  const name = decodeEntities(product.name ?? "").toLowerCase()
  if (isAddon(name)) return "addon"
  if (cats.some((c) => /bundle/.test(c)) || /\bbundle\b/.test(name)) return "bundle"
  return "pattern"
}

export const ohhhLuluAdapter: DesignerAdapter = {
  slug: "ohhh-lulu",
  label: "Ohhh Lulu",
  matchHosts: ["ohhhlululingerie.com", "www.ohhhlululingerie.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (isNonPattern(product)) continue
      const name = cleanOhhhLuluName(product.name ?? "")
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
