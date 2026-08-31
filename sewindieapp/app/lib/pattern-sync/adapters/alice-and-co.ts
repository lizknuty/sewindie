import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"
import { decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Alice & Co Patterns (aliceandcopatterns.com) -- Shopify.
//
// A mixed catalogue: alongside sewing patterns the store sells online classes,
// an advent calendar, physical books, and textile tours. Shopify product_type
// cleanly separates them, so we classify by type:
//   - "PATTERN" / "free pattern"        -> pattern
//   - "Bundle"                          -> bundle
//   - "free hack" (garment mods/hacks)  -> addon
//   - everything else (online class, advent calendar, book, gift card, and the
//     untyped tours/summer-school listings) is excluded.
// ---------------------------------------------------------------------------

const BASE = "https://aliceandcopatterns.com"

const KIND_BY_TYPE: Record<string, ScrapedPattern["kind"]> = {
  pattern: "pattern",
  "free pattern": "pattern",
  bundle: "bundle",
  "free hack": "addon",
}

function firstImage(product: ShopifyProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const aliceAndCoAdapter: DesignerAdapter = {
  slug: "alice-and-co",
  label: "Alice + Co Patterns",
  matchHosts: ["aliceandcopatterns.com", "www.aliceandcopatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const kind = KIND_BY_TYPE[(product.product_type ?? "").trim().toLowerCase()]
      if (!kind) continue // online class, advent calendar, book, gift card, untyped tour

      const name = decodeEntities((product.title ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(BASE, product.handle),
        imageUrl: firstImage(product),
        releaseDate: product.published_at ?? product.created_at ?? null,
        kind,
        sourceId: String(product.id),
      })
    }

    return results
  },
}
