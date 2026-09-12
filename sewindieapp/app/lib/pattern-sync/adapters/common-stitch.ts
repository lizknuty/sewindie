import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Common Stitch (commonstitch.com.au) -- Shopify.
//
// Mostly UNTYPED products mixing patterns with fabric-by-the-metre, elastic,
// and a gift card. Patterns are named "<Design> PAPER Pattern" / "<Design>
// DIGITAL Pattern", so most designs appear as a PAPER + DIGITAL twin. We:
//   1. keep only products whose title contains "pattern" and drop fabric /
//      elastic / notion / gift-card listings,
//   2. collapse the PAPER + DIGITAL twins by cleaned name (DIGITAL wins).
// ---------------------------------------------------------------------------

const STORE = "https://www.commonstitch.com.au"

const IS_PATTERN = /\bpattern\b/i
const EXCLUDE =
  /\bgift\s*card\b|\blinen\b|\bfabric\b|\belastic\b|\bthread\b|\bzip(?:per)?\b|\$\d+\s*(?:per|\/)|\bper\s*m\b/i
const BUNDLE = /\b(?:bundle|pack|set)\b/i

// Reduce "<Design> PAPER Pattern" / "<Design> - DIGITAL Pattern" to the design.
export function cleanCommonStitchName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\b(?:paper|digital|pdf|printed)\b/gi, " ")
    .replace(/\s*[-–—]?\s*pattern\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function collapseKey(title: string): string {
  return cleanCommonStitchName(title)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const commonStitchAdapter: DesignerAdapter = {
  slug: "common-stitch",
  label: "Common Stitch",
  matchHosts: ["commonstitch.com.au", "www.commonstitch.com.au"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // DIGITAL listing wins as canonical.
    const sorted = [...products].sort((a, b) => {
      const aDig = /digital/i.test(a.title) ? 0 : 1
      const bDig = /digital/i.test(b.title) ? 0 : 1
      return aDig - bDig
    })

    const byKey = new Map<string, ScrapedPattern>()
    for (const product of sorted as ShopifyProduct[]) {
      if (EXCLUDE.test(product.title)) continue
      if (!IS_PATTERN.test(product.title)) continue
      const name = cleanCommonStitchName(product.title)
      if (!name) continue
      const key = collapseKey(product.title)
      if (byKey.has(key)) continue

      byKey.set(key, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return [...byKey.values()]
  },
}
