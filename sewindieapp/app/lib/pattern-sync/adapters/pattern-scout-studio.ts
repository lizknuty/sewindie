import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Pattern Scout Studio (patternscoutstudio.com)
// ---------------------------------------------------------------------------
// A Shopify store (~30 products). product_type is a garment category
// (Tops/Pants/Dresses/Accessories) but also tags a few non-sewing items (a
// paper-craft "Christmas Village", "Kitchen Island Build Plans", a "Bowl Cozy
// PDF Template"). Every real garment pattern's title ends with "- PDF SEWING
// PATTERN", so we filter on that phrase in the title -- this keeps only the
// sewing patterns and drops the craft/build/template extras.
//
// Names: strip the "- PDF SEWING PATTERN" tail plus a trailing qualifier
// parenthetical ("(no instructions, pattern only)"). published_at kept.
// ---------------------------------------------------------------------------

const STORE = "https://patternscoutstudio.com"

const IS_SEWING_PATTERN = /sewing\s+pattern/i
// "- PDF SEWING PATTERN" (and any trailing parenthetical after it).
const PATTERN_TAIL = /\s*[-–]\s*pdf\s+sewing\s+pattern\b.*$/i
const TRAILING_PAREN = /\s*\([^)]*\)\s*$/

// Clean a Pattern Scout title to its design name. Exported for tests.
export function cleanPatternScoutName(title: string): string {
  let name = (title ?? "").replace(/\s+/g, " ").trim()
  name = name.replace(PATTERN_TAIL, "").trim()
  name = name.replace(TRAILING_PAREN, "").trim()
  return name
}

export const patternScoutStudioAdapter: DesignerAdapter = {
  slug: "pattern-scout-studio",
  label: "Pattern Scout Studio",
  matchHosts: ["patternscoutstudio.com", "www.patternscoutstudio.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const title = (product.title ?? "").trim()
      if (!IS_SEWING_PATTERN.test(title)) continue // drops craft/build/template items

      const name = cleanPatternScoutName(title)
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
    }
    return results
  },
}
