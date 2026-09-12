import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Birgitta Helmersson (birgittahelmersson.com) -- Shopify.
//
// A zero-waste (ZW) label that sells THREE things in one Shopify store:
//   1. PDF sewing patterns  -> product_type "PDF Sewing Pattern" (+ one untyped
//      "ZW Tier Dress - PDF Pattern"),
//   2. physical finished garments -> product_type "Garment" (titles carry a
//      fabric/size/"Made to Order" qualifier: "ZW INDIGO TROUSER", "ZW Frill
//      Sleeve Top - Black", "ZW Block Pant - Natural - Made to Order"),
//   3. books -> untyped "ZERO WASTE PATTERNS - BOOK", etc.
//
// Only #1 belongs in a pattern catalogue, so we KEEP a product only when it is
// a PDF pattern: product_type contains "PDF" OR the title says "PDF Pattern".
// That cleanly drops the physical garments and books. The "GATHER TEE - HACK
// PDF - ADD ON TO 'ZERO WASTE PATTERNS' BOOK" is a pattern hack add-on -> addon.
// ---------------------------------------------------------------------------

const STORE = "https://www.birgittahelmersson.com"

const IS_PDF_PATTERN = /\bpdf\b/i
const ADDON_TITLE = /\b(?:hack|add[-\s]?on|expansion)\b/i

// Strip the "PDF (Sewing) Pattern" boilerplate for display.
export function cleanBirgittaName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/\s*[-–—]\s*pdf\b\s*(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\s*\bpdf\b\s*(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function isPdfPattern(product: ShopifyProduct): boolean {
  return IS_PDF_PATTERN.test(product.product_type ?? "") || IS_PDF_PATTERN.test(product.title)
}

export const birgittaHelmerssonAdapter: DesignerAdapter = {
  slug: "birgitta-helmersson",
  label: "Birgitta Helmersson",
  matchHosts: ["birgittahelmersson.com", "www.birgittahelmersson.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products) {
      if (!isPdfPattern(product)) continue // drops physical garments + books
      const name = cleanBirgittaName(product.title)
      if (!name) continue

      const kind: ProductKind = ADDON_TITLE.test(product.title) ? "addon" : "pattern"
      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind,
        sourceId: String(product.id),
      })
    }

    return out
  },
}
