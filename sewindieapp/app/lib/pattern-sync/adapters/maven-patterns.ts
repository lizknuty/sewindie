import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Maven Patterns (mavenpatterns.co.uk) -- WooCommerce.
//
// Mixed shop: ~127 products spanning sewing patterns AND a large haberdashery
// range (buttons, elastic, thread, needles, tools, kits, interfacing). We keep
// ONLY products in a sewing-pattern category and drop the haberdashery/tools.
//
// Category taxonomy (observed):
//   pattern cats:  "Sewing Patterns - All", "Sewing Patterns in sizes ...",
//                  "MAVEN1832 ...", "<Garment> sewing patterns", "Apron Sewing
//                  Patterns", "Free & Charity Patterns", "Sewing Pattern
//                  Collections[ & Bundles]"
//   NON-pattern:   "Eco Haberdashery", "...Buttons", "...elastics", "needles",
//                  "Sewing & Maker Tools", "Interfacing", "Gifts for Makers",
//                  "the Maven Kits", "Eco Sewing Thread", etc.
// A "Sewing Pattern Collections" / "...& Bundles" membership -> bundle.
// ---------------------------------------------------------------------------

const BASE = "https://mavenpatterns.co.uk"

const PATTERN_CATEGORY = /sewing pattern|patterns? in sizes|maven1832|apron sewing|charity pattern|pattern collection/i
const BUNDLE_CATEGORY = /collection|bundle/i

export function cleanMavenName(rawName: string): string {
  return decodeEntities(rawName)
    // Drop a leading size-range label like "MAVEN1832 / " on size-variant listings.
    .replace(/^maven\s*1832\s*[/|-]\s*/i, "")
    .replace(/\s*[-–—|]\s*\d*\s*(pdf|digital|printed|paper)\b.*$/i, "")
    .replace(/\s*\b(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/\s+\bpdf\b\s*$/i, "")
    .replace(/^the\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function patternCategories(product: WooProduct): string[] {
  return (product.categories ?? []).map((c) => c?.name ?? "")
}

function isPattern(product: WooProduct): boolean {
  return patternCategories(product).some((c) => PATTERN_CATEGORY.test(c))
}

function classify(product: WooProduct, name: string): ProductKind {
  const cats = patternCategories(product)
  if (/\bexpansion\b|\badd.?on\b/i.test(name)) return "addon"
  if (cats.some((c) => BUNDLE_CATEGORY.test(c)) || /\bbundle\b|\bcollection\b|set of\b/i.test(name)) return "bundle"
  return "pattern"
}

export const mavenPatternsAdapter: DesignerAdapter = {
  slug: "maven-patterns",
  label: "Maven Patterns",
  matchHosts: ["mavenpatterns.co.uk", "www.mavenpatterns.co.uk"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!isPattern(product)) continue
      const name = cleanMavenName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(product, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
