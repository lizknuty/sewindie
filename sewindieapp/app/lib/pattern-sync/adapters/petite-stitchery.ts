import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Petite Stitchery & Co (petitestitchery.com)
// ---------------------------------------------------------------------------
// A large Shopify store (~538 products) hosting several sub-brands. Patterns
// are the products whose product_type starts with "Pattern" (e.g. "Pattern",
// "Pattern- Riley", "Pattern- Herrman"); the only non-pattern is "Gift Cards".
//
// AGE VARIANTS ARE DISTINCT PRODUCTS. Petite Stitchery sells each size range as
// its own purchasable pattern ("Adult Rhosyn ...", "Kids Rhosyn ...", "Baby
// Aspen Skirt"), each with its own price and page. Per the project convention
// (only pure format duplicates like PDF-vs-paper are collapsed; real distinct
// products are kept), all age variants are kept as separate rows. There are no
// exact-duplicate titles and no PDF/paper split here, so no collapsing is done.
//
// Titles are already clean design names, kept as-is. "... Bundle" is flagged as
// a bundle. published_at is a real release date, kept.
// ---------------------------------------------------------------------------

const STORE = "https://petitestitchery.com"

const PATTERN_TYPE = /^pattern/i
const BUNDLE = /\bbundle\b/i

function classify(title: string): ProductKind {
  return BUNDLE.test(title) ? "bundle" : "pattern"
}

export const petiteStitcheryAdapter: DesignerAdapter = {
  slug: "petite-stitchery",
  label: "Petite Stitchery & Co",
  matchHosts: ["petitestitchery.com", "www.petitestitchery.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!PATTERN_TYPE.test(product.product_type ?? "")) continue // skips "Gift Cards"

      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }
    return results
  },
}
