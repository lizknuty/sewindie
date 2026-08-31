import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Peppermint Magazine (peppermintmag.com) -- WooCommerce.
//
// Peppermint is a magazine store selling issues/subscriptions AND a run of free
// "Sewing School" PDF patterns (a well-known indie collab series). We keep ONLY
// the "Sewing School" category products -- those are the sewing patterns -- and
// drop magazine issues, subscriptions, merch, etc.
//
// Names look like "Peppermint Wrap Top - Sewing School" -> strip the trailing
// "- Sewing School" and any "Free Sewing Pattern" suffix.
// ---------------------------------------------------------------------------

const BASE = "https://peppermintmag.com"
const PATTERN_CATEGORY = /sewing school/i

export function cleanPeppermintName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*sewing school\b.*$/i, "")
    .replace(/\s*\b(free\s+)?(pdf\s+)?sewing pattern\b.*$/i, "")
    .replace(/^peppermint\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (/\bbundle\b/i.test(name)) return "bundle"
  return "pattern"
}

function isSewingSchool(product: WooProduct): boolean {
  return (product.categories ?? []).some((c) => PATTERN_CATEGORY.test(c?.name ?? ""))
}

export const peppermintAdapter: DesignerAdapter = {
  slug: "peppermint",
  label: "Peppermint",
  matchHosts: ["peppermintmag.com", "www.peppermintmag.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!isSewingSchool(product)) continue
      const name = cleanPeppermintName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
