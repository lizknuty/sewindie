import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Cashmerette (cashmerette.com) -- Shopify.
//
// A large plus-size pattern house that sells each design in MANY listings:
//   - "PDF Pattern" type ("Wellfleet T-Shirt PDF pattern")
//   - "Printed Pattern" type, split by size range and bundled with the PDF
//     ("Montrose Top 12-32 printed pattern + free PDF", "... 0-16 ...")
//   - "Wholesale" printed variants (B2B duplicates)
// plus non-patterns typed Class / Membership / Sketchbook / Gift Card.
//
// So we:
//   1. EXCLUDE non-pattern types (class/membership/sketchbook/gift card) and any
//      "wholesale" listing (B2B duplicate),
//   2. COLLAPSE the remaining PDF + printed + size-range listings of one design
//      into a single entry, keyed by the cleaned design name,
//   3. prefer the PDF listing as canonical (cleanest name) -- we sort PDF-typed
//      first, then take first-wins.
// Expansion packs and bundles keep their own name (not merged into a base) and
// are classified addon / bundle respectively.
// ---------------------------------------------------------------------------

const STORE = "https://www.cashmerette.com"

const EXCLUDE_TYPE = /class|membership|sketchbook|gift\s*card/i
const WHOLESALE = /wholesale/i
const EXPANSION_TITLE = /\bexpansion\b/i
const BUNDLE_TITLE = /\b(?:bundle|mix\s*&?\s*match\s*pack)\b/i

// Reduce a raw listing title to the design name: drop format words, size
// ranges, "+ free PDF", and wholesale markers. Expansion/bundle words are kept
// so those products stay distinct from their base design.
export function cleanCashmeretteName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/\+\s*free\s*pdf/gi, " ")
    .replace(/:?\s*\bwholesale\b/gi, " ")
    .replace(/\b\d{1,2}\s*-\s*\d{1,2}\b/g, " ") // size range 0-16 / 12-32
    .replace(/\b(?:pdf|printed|paper)\b\s*(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\b(?:pdf|printed)\b/gi, " ")
    .replace(/\s*[-–—]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

export function cashmeretteKey(title: string): string {
  return cleanCashmeretteName(title).toLowerCase()
}

function classify(name: string): ProductKind {
  if (EXPANSION_TITLE.test(name)) return "addon"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

function isPattern(product: ShopifyProduct): boolean {
  const type = product.product_type ?? ""
  if (EXCLUDE_TYPE.test(type)) return false
  if (WHOLESALE.test(product.title)) return false
  // Keep anything that is a pattern by type or title.
  return /pattern/i.test(type) || /pattern/i.test(product.title)
}

export const cashmeretteAdapter: DesignerAdapter = {
  slug: "cashmerette",
  label: "Cashmerette",
  matchHosts: ["cashmerette.com", "www.cashmerette.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // Sort PDF-typed listings first so they win as the canonical entry.
    const sorted = [...products].sort((a, b) => {
      const aPdf = /pdf/i.test(a.product_type ?? "") ? 0 : 1
      const bPdf = /pdf/i.test(b.product_type ?? "") ? 0 : 1
      return aPdf - bPdf
    })

    const byKey = new Map<string, ScrapedPattern>()
    for (const product of sorted) {
      if (!isPattern(product)) continue
      const name = cleanCashmeretteName(product.title)
      if (!name) continue
      const key = cashmeretteKey(product.title)
      if (byKey.has(key)) continue // first (PDF) listing wins

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
