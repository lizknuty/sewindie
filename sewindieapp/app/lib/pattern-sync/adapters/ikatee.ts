import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Ikatee (ikatee.fr) -- Shopify, French. NB the DB URL is ikatee.com, which
// 301-redirects to ikatee.fr where the storefront actually lives.
//
// ~1266 total products, mostly haberdashery (Tissu/fabric, Fils/thread,
// Boutons/buttons, Zip, Élastiques, Coupon...). We keep ONLY the sewing-pattern
// product types:
//   - "Patron de couture"          (digital PDF pattern)
//   - "Pochette Patron de couture" (paper-envelope version of the SAME design)
// Every paper "pochette" has a PDF twin, so we collapse by cleaned design name
// and prefer the PDF listing as canonical (285 listings -> ~178 designs).
// Title shape: "Patron <garment> <NAME> pochette/PDF". We strip the leading
// "Patron " label and the trailing "pochette"/"PDF" format word.
// "Kit"/"Duo"/"Pack" in the type/name -> handled as pattern (Duo = 2-garment
// pattern, still one product); no bundles/addons in the pattern feed.
// ---------------------------------------------------------------------------

const STORE = "https://ikatee.fr"

// Pattern product types (fabric, thread, buttons, etc. are excluded).
const KEEP_TYPE = /^(pochette\s+)?patron de couture$/i

export function cleanIkateeName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—|]\s*(pdf|pochette).*$/i, "") // drop format tail after a separator
    .replace(/\s+\b(pochette|pdf|papier)\b\s*$/i, "") // drop bare trailing format word
    .replace(/^patron\s+(de\s+couture\s+)?/i, "") // drop leading "Patron"/"Patron de couture" label
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  if (/\b(bundle|lot de|pack de)\b/i.test(name)) return "bundle"
  return "pattern"
}

export const ikateeAdapter: DesignerAdapter = {
  slug: "ikatee",
  label: "Ikatee Patterns",
  matchHosts: ["ikatee.com", "www.ikatee.com", "ikatee.fr", "www.ikatee.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = (await fetchShopifyProducts(STORE)) as ShopifyProduct[]
    // Digital PDF listings first so they win as the canonical entry on collapse.
    const ordered = products
      .filter((p) => KEEP_TYPE.test((p.product_type ?? "").trim()))
      .sort(
        (a, b) =>
          (/pochette/i.test(a.product_type ?? "") ? 1 : 0) - (/pochette/i.test(b.product_type ?? "") ? 1 : 0),
      )

    const byName = new Map<string, ScrapedPattern>()
    for (const product of ordered) {
      const name = cleanIkateeName(product.title)
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
