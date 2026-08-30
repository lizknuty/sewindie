import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Sew House Seven (sewhouse7.com) -- Shopify.
//
// product_type separates the catalogue cleanly: "PDF Pattern" and "Paper
// Pattern" are the sewing patterns; "Wholesale"/"wholesale", "Gift Cards", and
// the odd untyped product are excluded.
//
// Each design is sold up to THREE times, differing only by descriptor:
//   "Revel Topper Sewing Pattern (PDF)"        (PDF Pattern)
//   "Revel Topper Sewing Pattern (Printed)"    (Paper Pattern)
//   "Revel Topper CURVY FIT Sewing Pattern (PDF)"  (a size-range variant)
// All three are one design, so we collapse by a key that drops the trailing
// "(PDF)"/"(Printed)" format token, the "CURVY FIT" size-range marker, and the
// boilerplate "Sewing Pattern" words. 71 listings -> ~38 designs. The PDF
// listing wins as canonical (digital is the primary product); a Printed-only
// design keeps its Printed listing. Release date from published_at.
// ---------------------------------------------------------------------------

const STORE = "https://sewhouse7.com"

const PATTERN_TYPE = /pattern/i
const WHOLESALE_TYPE = /wholesale/i

const FORMAT_TOKEN = /\s*\((?:pdf|printed|paper)\)\s*/gi
const CURVY = /\bcurvy fit\b/gi
const SEWING_PATTERN_WORDS = /\bsewing pattern\b/gi

// Reduce a raw title to the design identity used for collapsing.
export function sewHouseSevenKey(title: string): string {
  return cleanSewHouseSevenName(title).toLowerCase()
}

// Display name: strip the format token, the CURVY FIT marker, and the
// "Sewing Pattern" boilerplate; tidy whitespace. Preserves the design name.
export function cleanSewHouseSevenName(title: string): string {
  const cleaned = (title ?? "")
    .replace(FORMAT_TOKEN, " ")
    .replace(CURVY, " ")
    .replace(SEWING_PATTERN_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function isPatternProduct(product: ShopifyProduct): boolean {
  const type = (product.product_type ?? "").trim()
  return PATTERN_TYPE.test(type) && !WHOLESALE_TYPE.test(type)
}

export const sewHouseSevenAdapter: DesignerAdapter = {
  slug: "sew-house-seven",
  label: "Sew House Seven",
  matchHosts: ["sewhouse7.com", "www.sewhouse7.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const byKey = new Map<string, ScrapedPattern>()
    const canonicalIsPdf = new Map<string, boolean>()
    const isPdf = (title: string) => /\(pdf\)/i.test(title)

    for (const product of products) {
      if (!isPatternProduct(product)) continue
      const name = cleanSewHouseSevenName(product.title)
      if (!name) continue
      const key = sewHouseSevenKey(product.title)
      const productIsPdf = isPdf(product.title)

      // Keep the first listing for a design, but upgrade to the PDF listing if
      // the currently-stored one is not a PDF.
      if (byKey.has(key) && !(productIsPdf && !canonicalIsPdf.get(key))) continue

      byKey.set(key, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: "pattern",
        sourceId: String(product.id),
      })
      canonicalIsPdf.set(key, productIsPdf)
    }

    return [...byKey.values()]
  },
}
