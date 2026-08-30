import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Thread Theory (threadtheory.ca) -- Shopify. Menswear sewing patterns.
//
// Clean catalogue (~56): product_type is "PDF Sewing Pattern"/"Sewing Patterns"
// plus a "Free Download" type covering two genuinely free patterns (Fairfield
// Button-up, Arrowsmith Undershirt) -- those ARE patterns and are kept. There
// are no bundles or gift cards in the feed; we still guard against a gift card
// by name defensively. "Free Download" items are flagged bonus so an admin can
// see they're the free variants. Titles are clean design names; we strip the
// "PDF"/"Free" pattern boilerplate for readability. Date from published_at.
// ---------------------------------------------------------------------------

const STORE = "https://threadtheory.ca"

const GIFT = /gift\s*card|gift\s*voucher/i
const FREE_TYPE = /free download/i

// Titles come as "<Name> (PDF )Sewing Pattern" or "<Name> PDF - <variation>".
// Strip the pattern/PDF boilerplate but KEEP the variation descriptor (e.g.
// "- Women's", "- Men's Sizing") because those are distinct purchasable
// products, so the display name stays unambiguous.
export function cleanThreadTheoryName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/\s*\b(?:pdf\s+)?(?:free\s+)?sewing pattern\b\s*/gi, " ")
    .replace(/\s*\bfree pattern\b\s*/gi, " ")
    // standalone "PDF" token (e.g. "Woodley Tee PDF - Women's Sizing")
    .replace(/\s*\bpdf\b\s*/gi, " ")
    // tidy a now-dangling separator: "Woodley Tee  - Women's" -> "Woodley Tee - Women's"
    .replace(/\s+([-–—])\s+/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

export const threadTheoryAdapter: DesignerAdapter = {
  slug: "thread-theory",
  label: "Thread Theory",
  matchHosts: ["threadtheory.ca", "www.threadtheory.ca", "threadtheory.com", "www.threadtheory.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products) {
      const type = product.product_type ?? ""
      if (GIFT.test(type) || GIFT.test(product.title)) continue
      const name = cleanThreadTheoryName(product.title)
      if (!name) continue

      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        // Free variants are real patterns but flagged so an admin sees them.
        kind: FREE_TYPE.test(type) ? "bonus" : "pattern",
        sourceId: String(product.id),
      })
    }

    return out
  },
}
