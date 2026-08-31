import type { ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Shared Closet Core Shopify store crawler.
//
// Closet Core acquired Deer & Doe, and BOTH brands now sell from the SAME
// Shopify store. deer-and-doe.com and closetcorepatterns.com serve an identical
// /products.json feed (~229 products). The discriminator is the `vendor` field:
//   - "Closet Core Patterns" / "Closet Core CREW"  -> Closet Core
//   - "Deer & Doe"                                 -> Deer and Doe
//   - "Core Fabrics"                               -> fabric (excluded from both)
//
// The store also carries many non-pattern and duplicate listings. We keep only
// real pattern product_types and collapse the "- Crew Pattern" format twins of
// a single design into one entry (PDF/plain listing wins as canonical).
// ---------------------------------------------------------------------------

const STORE = "https://closetcorepatterns.com"

// product_types that ARE patterns.
const PATTERN_TYPE = /^(?:pdf\s+)?sewing pattern$|crew pattern|pattern bundle|pdf pattern expansion/i
// product_types / titles that are NOT patterns (belt-and-suspenders).
const EXCLUDE_TYPE =
  /wholesale|duplicate listing|classes?|crew plans|holiday kit|^kit$|sewing labels|not a pattern|gift\s*card/i
const EXPANSION = /\bexpansion\b/i
const BUNDLE = /\bbundle\b/i

// Reduce a listing title to its design name: drop the "- Crew Pattern" /
// "- Pattern" format suffix and pattern boilerplate so format twins collapse.
export function cleanClosetCoreName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—]\s*crew pattern\b/gi, " ")
    .replace(/\s*[-–—]\s*pdf (?:sewing )?pattern\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function collapseKey(title: string): string {
  return cleanClosetCoreName(title)
    .toLowerCase()
    .replace(/\bpattern\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (EXPANSION.test(name)) return "addon"
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

function isPattern(product: ShopifyProduct): boolean {
  const type = product.product_type ?? ""
  if (EXCLUDE_TYPE.test(type)) return false
  return PATTERN_TYPE.test(type)
}

// Crawl the shared store and return only the products whose vendor matches.
export async function fetchClosetCoreVendor(vendorMatch: RegExp): Promise<ScrapedPattern[]> {
  const products = await fetchShopifyProducts(STORE)

  // Non-"crew"/non-"pdf" listing wins as canonical (cleanest name), so sort
  // format-suffixed listings last.
  const sorted = [...products].sort((a, b) => {
    const aFmt = /crew pattern|pdf/i.test(a.product_type ?? "") ? 1 : 0
    const bFmt = /crew pattern|pdf/i.test(b.product_type ?? "") ? 1 : 0
    return aFmt - bFmt
  })

  const byKey = new Map<string, ScrapedPattern>()
  for (const product of sorted) {
    if (!vendorMatch.test(product.vendor ?? "")) continue
    if (!isPattern(product)) continue
    const name = cleanClosetCoreName(product.title)
    if (!name) continue
    const key = collapseKey(product.title)
    if (byKey.has(key)) continue // first (canonical) listing wins

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
}
