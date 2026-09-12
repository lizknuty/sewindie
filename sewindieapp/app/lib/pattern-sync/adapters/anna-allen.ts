import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"
import { decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Anna Allen Clothing (annaallenclothing.com) -- Shopify.
//
// Small, clean catalogue: every product is a PDF sewing pattern except one
// "Add On" (Zipper Expansion) which is an add-on. Titles carry a
// "- PDF (Womens )Sewing Pattern/Instructions Sizes X-Y" tail we strip to the
// design name. Kind comes from product_type ("Add On" -> addon).
// ---------------------------------------------------------------------------

const BASE = "https://annaallenclothing.com"

// Strip the trailing format+size descriptor:
//   "Anthea Blouse + Dress - PDF Sewing Pattern Sizes 0-30" -> "Anthea Blouse + Dress"
//   "Zipper Expansion - PDF Sewing Instructions"            -> "Zipper Expansion"
//   "Pomona Pants KIDS - PDF Sewing Pattern Sizes ..."      -> "Pomona Pants KIDS"
export function cleanAnnaAllenName(title: string): string {
  const cleaned = decodeEntities(title ?? "")
    .replace(/\s*[-–—]\s*pdf\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || decodeEntities(title ?? "").trim()
}

function firstImage(product: ShopifyProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const annaAllenAdapter: DesignerAdapter = {
  slug: "anna-allen",
  label: "Anna Allen",
  matchHosts: ["annaallenclothing.com", "www.annaallenclothing.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const type = (product.product_type ?? "").trim().toLowerCase()
      if (/gift/i.test(type) || /gift card/i.test(product.title ?? "")) continue

      const name = cleanAnnaAllenName(product.title ?? "")
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(BASE, product.handle),
        imageUrl: firstImage(product),
        releaseDate: product.published_at ?? product.created_at ?? null,
        kind: type === "add on" || /\bexpansion\b/i.test(name) ? "addon" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
