import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Sew Liberated (sewliberated.com) -- WooCommerce.
//
// ~96 products, but the shop is a MIX: PDF garment patterns, online sewing
// COURSES, physical "Printed Pattern Pieces" (paper companions to a PDF), gift
// cards, and community items. We keep sewing patterns and classify carefully:
//
//   EXCLUDE:
//     - "Courses" category, and any "Learn to Sew ..." / "... Course" item
//     - "Gift Cards" category / gift-card names
//     - "Community" category (memberships etc.)
//   CLASSIFY:
//     - "Printed Pattern Pieces" category, or name "Pattern Piece(s) Print" /
//       "Printed Pattern" -> addon (paper add-on to a PDF pattern)
//     - "Discount Bundles" category or name "Bundle" -> bundle (but a
//       COURSE bundle is excluded above)
//     - else -> pattern
//
// Store API omits date_created here (0/96), so releaseDate is null.
// Names carry a trailing "Pattern" and HTML entities to clean.
// ---------------------------------------------------------------------------

const BASE = "https://sewliberated.com"

function cats(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => (c?.name ?? "").toLowerCase())
}

function isCourse(product: WooProduct, name: string): boolean {
  return cats(product).some((c) => /courses?/.test(c)) || /\blearn to sew\b|\bcourse\b|\bworkshop\b/.test(name)
}

function isNonPattern(product: WooProduct, name: string): boolean {
  const c = cats(product)
  if (c.some((x) => /gift card|community/.test(x))) return true
  if (/gift card/.test(name)) return true
  // A course (or course bundle) is not a sewing pattern.
  if (isCourse(product, name)) return true
  return false
}

function classify(product: WooProduct, name: string): ProductKind {
  const c = cats(product)
  if (c.some((x) => /printed pattern piece/.test(x)) || /pattern pieces? print|printed pattern/.test(name))
    return "addon"
  if (c.some((x) => /bundle/.test(x)) || /\bbundle\b/.test(name)) return "bundle"
  return "pattern"
}

export function cleanSewLiberatedName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*(pdf|digital|printed)\b.*$/i, "")
    .replace(/\s*\b(pdf\s+)?sewing pattern\b\s*$/i, "")
    .replace(/\s*\bpattern\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

export const sewLiberatedAdapter: DesignerAdapter = {
  slug: "sew-liberated",
  label: "Sew Liberated",
  matchHosts: ["sewliberated.com", "www.sewliberated.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const rawLower = decodeEntities(product.name ?? "").toLowerCase()
      if (isNonPattern(product, rawLower)) continue
      const kind = classify(product, rawLower)
      const name = cleanSewLiberatedName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind,
        sourceId: String(product.id),
      })
    }

    return results
  },
}
