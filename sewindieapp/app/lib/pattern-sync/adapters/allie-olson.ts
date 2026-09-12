import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"
import { decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Allie Olson Sewing Patterns (allieolson.com) -- Shopify.
//
// The store now also sells in-person weaving/basketry workshops and craft goods
// (e.g. "Intro to Branch Weaving (November 22 ...)", "Pine Needle Earrings"),
// which are NOT sewing patterns. The garment patterns are identified by a
// garment product_type OR garment tag (Tops, Bottoms, Dresses, Skirts, etc.);
// the workshops/goods carry neither, so filtering on garment category cleanly
// keeps only the ~11 sewing patterns.
// ---------------------------------------------------------------------------

const BASE = "https://www.allieolson.com"

// Garment categories used across product_type and tags.
const GARMENT = /\b(tops?|bottoms?|dresses|dress|skirts?|pants?|jackets?|coats?|vests?|tanks?|cardigans?|jeans|shorts|jumpsuits?|outerwear|knits?)\b/i

function isGarment(product: ShopifyProduct): boolean {
  if (GARMENT.test(product.product_type ?? "")) return true
  return (product.tags ?? []).some((t) => GARMENT.test(t))
}

function firstImage(product: ShopifyProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

export const allieOlsonAdapter: DesignerAdapter = {
  slug: "allie-olson",
  label: "Allie Olson Sewing Patterns",
  matchHosts: ["allieolson.com", "www.allieolson.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!isGarment(product)) continue // skip workshops and craft goods

      const name = decodeEntities((product.title ?? "").replace(/\s+/g, " ").trim())
      if (!name) continue

      results.push({
        name,
        url: shopifyProductUrl(BASE, product.handle),
        imageUrl: firstImage(product),
        releaseDate: product.published_at ?? product.created_at ?? null,
        kind: /\bbundle\b/i.test(name) ? "bundle" : "pattern",
        sourceId: String(product.id),
      })
    }

    return results
  },
}
