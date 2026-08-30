import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Pattern Paper Scissors (patternpaperscissors.co.uk) -- Shopify, but the shop
// is FABRIC-heavy: product_type is Fabric / Sewing Labels / Tubular Rib /
// Scissors / (none). Sewing patterns have NO product_type and are identified by
// "pattern" appearing in the title. 30 patterns out of 166 products.
//
// Titles are long and descriptive with a size/format tail:
//   "Girls Jersey Smock Dress - Sewing Pattern, Sizes 2-11 yrs, PDF Option"
//   "Roux Children's Legging Sewing Pattern - Unisex, ... Paper and PDF Options"
// cleanName trims a trailing "Sewing Pattern"/"Pattern" descriptor plus the
// size/format clauses that follow it, keeping the garment description. Leading
// "FREE " marketing prefix is dropped. "Bundle …Pack" -> bundle.
// published_at is a real release date.
// ---------------------------------------------------------------------------

const STORE = "https://patternpaperscissors.co.uk"

// A pattern is an un-typed product whose title mentions a pattern.
const PATTERN_TITLE = /\bpattern\b/i
const BUNDLE = /\bbundle\b.*\bpack\b/i

export function cleanPpsName(title: string): string {
  let t = (title ?? "").replace(/\s+/g, " ").trim()
  // Drop leading marketing prefixes.
  t = t.replace(/^free\s+/i, "").trim()
  // Cut everything from the "(Sewing )Pattern" descriptor onward -- the size
  // ranges, "PDF Option", "Paper and PDF Options" etc. all follow it. Keep the
  // garment description that precedes it. Handle an optional " - " / "," before.
  t = t.replace(/\s*[-–,]?\s*(?:sewing\s+)?pattern\b.*$/i, "").trim()
  // A few titles put the format/size before "Pattern" ("...PDF Pattern"); if the
  // cut above removed everything, fall back to a token strip.
  if (!t) {
    t = (title ?? "").replace(/^free\s+/i, "").replace(/\bpdf\b|\bpaper\b/gi, "").replace(/\bpattern\b/gi, "").replace(/\s+/g, " ").trim()
  }
  return t || (title ?? "").trim()
}

export const patternPaperScissorsAdapter: DesignerAdapter = {
  slug: "pattern-paper-scissors",
  label: "Pattern Paper Scissors",
  matchHosts: ["patternpaperscissors.co.uk", "www.patternpaperscissors.co.uk"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()
    for (const product of products) {
      if ((product.product_type ?? "").trim()) continue // fabric, labels, etc.
      if (!PATTERN_TITLE.test(product.title ?? "")) continue

      const name = cleanPpsName(product.title)
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const image = product.images?.[0]?.src ?? null
      const kind: ProductKind = BUNDLE.test(product.title ?? "") ? "bundle" : "pattern"
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: image,
        releaseDate: product.published_at ?? null,
        kind,
        sourceId: String(product.id),
      })
    }
    return results
  },
}
