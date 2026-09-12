import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Chalk and Notch (chalkandnotch.com) -- Shopify.
//
// Most designs are sold as both a "PDF Pattern" and a "Printed Pattern" listing
// (same design, two formats). We COLLAPSE those twins into one entry keyed by
// the cleaned design name, preferring the PDF listing as canonical. The lone
// Gift Card (typed "Gift Card") is excluded. A few "Expansion"/"Add-on"
// listings are classified addon; bundles -> bundle.
// ---------------------------------------------------------------------------

const STORE = "https://www.chalkandnotch.com"

const GIFT_CARD = /gift\s*card/i
const ADDON_TITLE = /\b(?:expansion|add[-\s]?on)\b/i
const BUNDLE_TITLE = /\bbundle\b/i

// Drop the format suffix so the PDF and printed listings map to one key:
//   "Fringe Dress + Top | PDF Pattern"  -> "Fringe Dress + Top"
//   "Fringe Dress + Top - Printed Pattern" -> "Fringe Dress + Top"
export function cleanChalkNotchName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/\s*[-–—|]\s*(?:pdf|printed|paper)\b.*$/i, "")
    .replace(/\b(?:pdf|printed|paper)\b\s*(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

export function chalkNotchKey(title: string): string {
  return cleanChalkNotchName(title).toLowerCase()
}

function classify(name: string): ProductKind {
  if (ADDON_TITLE.test(name)) return "addon"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

function isPattern(product: ShopifyProduct): boolean {
  const type = product.product_type ?? ""
  if (GIFT_CARD.test(type) || GIFT_CARD.test(product.title)) return false
  return true
}

export const chalkAndNotchAdapter: DesignerAdapter = {
  slug: "chalk-and-notch",
  label: "Chalk and Notch",
  matchHosts: ["chalkandnotch.com", "www.chalkandnotch.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // PDF listings first so they win as the canonical entry for a design.
    const sorted = [...products].sort((a, b) => {
      const aPdf = /pdf/i.test(a.product_type ?? "") ? 0 : 1
      const bPdf = /pdf/i.test(b.product_type ?? "") ? 0 : 1
      return aPdf - bPdf
    })

    const byKey = new Map<string, ScrapedPattern>()
    for (const product of sorted) {
      if (!isPattern(product)) continue
      const name = cleanChalkNotchName(product.title)
      if (!name) continue
      const key = chalkNotchKey(product.title)
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
