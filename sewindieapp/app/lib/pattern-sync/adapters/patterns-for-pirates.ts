import type { DesignerAdapter, ScrapedPattern } from "../types"
import { extractP4PMetadata } from "../metadata/patterns-for-pirates"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// Patterns for Pirates moved from WordPress/WooCommerce to Shopify (Oct 2026).
// The old `/wp-json/` API now returns a bare 400 from Cloudflare, so the
// catalogue comes from the public Shopify feed (`/products.json`).
//
// Verified shape (372 products, 2 pages at limit=250):
//   title / handle / images[0].src / published_at / tags / body_html
//
// Identity: the migration kept the WooCommerce slugs as Shopify handles
// (362 of 372 match exactly), but the path changed from `/product/<slug>/` to
// `/products/<handle>`. Every existing row stores the old form, so identity is
// the final URL segment, which is the same under both shapes.
//
// Filtering, by tag:
//   - "type:bundle"  -> kind "bundle"
//   - Non-pattern downloads (cut files, size-tag templates, printable charts,
//     iron-on designs) and the gift card carry none of the format:/fabric:/
//     garment: tags that every real pattern has, so they are dropped.

const STORE_BASE = "https://www.patternsforpirates.com"
const PATTERN_TAG_PREFIXES = ["format:", "fabric:", "garment:"]

function lastSegment(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parts = new URL(url).pathname.replace(/\/+$/, "").split("/").filter(Boolean)
    return parts.at(-1)?.toLowerCase() ?? null
  } catch {
    return null
  }
}

function isPatternProduct(product: ShopifyProduct): boolean {
  const tags = (product.tags ?? []).map((t) => t.toLowerCase())
  return tags.some((t) => PATTERN_TAG_PREFIXES.some((prefix) => t.startsWith(prefix)))
}

export const patternsForPiratesAdapter: DesignerAdapter = {
  slug: "patterns-for-pirates",
  label: "Patterns for Pirates",
  matchHosts: ["patternsforpirates.com", "www.patternsforpirates.com"],

  identityKey(url) {
    return lastSegment(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = (await fetchShopifyProducts(STORE_BASE)) as Array<ShopifyProduct & { body_html?: string }>
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!isPatternProduct(product)) continue
      const name = product.title?.replace(/\s+/g, " ").trim()
      if (!name || !product.handle) continue

      const tags = product.tags ?? []
      results.push({
        name,
        url: shopifyProductUrl(STORE_BASE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? product.created_at ?? null,
        kind: tags.some((t) => t.toLowerCase() === "type:bundle") ? "bundle" : "pattern",
        sourceId: String(product.id),
        metadata: extractP4PMetadata({ tags, description: product.body_html ?? "" }),
      })
    }

    return results
  },
}
