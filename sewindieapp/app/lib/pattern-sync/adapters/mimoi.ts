import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Mimoï (mimoi.fr) -- Shopify, French.
//
// ~78 listings. Each design is sold as a digital "Patron PDF" and (for some) a
// paper-envelope "Patron pochette" -- format twins of the SAME design. We
// collapse them by cleaned design name, preferring the PDF listing as canonical.
// Title shape: "<Name>, <garment> - Patron pochette/PDF". We keep the
// "<Name>, <garment>" part so two garments under one name stay distinct.
// "Pack"/"Lot" -> bundle. No non-pattern products in the feed.
// ---------------------------------------------------------------------------

const STORE = "https://mimoi.fr"

const KEEP_TYPE = /patron/i // "Patron PDF" or "Patron pochette"

export function cleanMimoiName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—]\s*patron\s*(pochette|pdf)\b.*$/i, "") // drop format tail
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (/\b(pack|lot|bundle)\b/i.test(name)) return "bundle"
  return "pattern"
}

export const mimoiAdapter: DesignerAdapter = {
  slug: "mimoi",
  label: "Mimoï",
  matchHosts: ["mimoi.fr", "www.mimoi.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = (await fetchShopifyProducts(STORE)) as ShopifyProduct[]
    // PDF listings first so they win as the canonical entry on collapse.
    const ordered = products
      .filter((p) => KEEP_TYPE.test(p.product_type ?? ""))
      .sort((a, b) => (/pdf/i.test(a.product_type ?? "") ? 0 : 1) - (/pdf/i.test(b.product_type ?? "") ? 0 : 1))

    const byName = new Map<string, ScrapedPattern>()
    for (const product of ordered) {
      const name = cleanMimoiName(product.title)
      if (!name) continue
      const key = name.toLowerCase()
      if (byName.has(key)) continue // format twin already captured (PDF preferred)
      byName.set(key, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return [...byName.values()]
  },
}
