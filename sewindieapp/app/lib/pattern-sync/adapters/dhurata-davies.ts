import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Dhurata Davies Patterns (dhuratadavies.com) -- Shopify.
//
// Each design is sold as BOTH a "Digital pattern" and a "Paper pattern" typed
// listing with near-identical titles ("Hattie Bag digital sewing pattern, PDF"
// vs "Hattie Bag printed sewing pattern, paper"). We collapse the twins by
// cleaned name (digital listing wins as canonical). A few non-pattern types
// (Needle Wallet / Pattern Weights / Pincushion) are excluded.
// ---------------------------------------------------------------------------

const STORE = "https://dhuratadavies.com"

const PATTERN_TYPE = /pattern/i
const EXCLUDE_TYPE = /needle wallet|pattern weights|pincushion/i
const BUNDLE = /\b(?:bundle|pack)\b/i

// Reduce a listing title to its design name: drop format words and the trailing
// "sewing pattern - ... sizes ..." description so digital/paper twins collapse.
export function cleanDhurataName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\b(?:digital|paper|printed|pdf)\b/gi, " ")
    .replace(/\s*[-,]?\s*(?:sewing )?pattern\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function collapseKey(title: string): string {
  return cleanDhurataName(title)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const dhurataDaviesAdapter: DesignerAdapter = {
  slug: "dhurata-davies",
  label: "Dhurata Davies Patterns",
  matchHosts: ["dhuratadavies.com", "www.dhuratadavies.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // Digital listing wins as canonical, so sort digital-typed first.
    const sorted = [...products].sort((a, b) => {
      const aDig = /digital/i.test(a.product_type ?? "") ? 0 : 1
      const bDig = /digital/i.test(b.product_type ?? "") ? 0 : 1
      return aDig - bDig
    })

    const byKey = new Map<string, ScrapedPattern>()
    for (const product of sorted) {
      const type = product.product_type ?? ""
      if (EXCLUDE_TYPE.test(type)) continue
      if (!PATTERN_TYPE.test(type)) continue
      const name = cleanDhurataName(product.title)
      if (!name) continue
      const key = collapseKey(product.title)
      if (byKey.has(key)) continue

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
