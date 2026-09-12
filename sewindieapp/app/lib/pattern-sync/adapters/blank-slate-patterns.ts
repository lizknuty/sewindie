import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Blank Slate Patterns (blankslatepatterns.com) -- Shopify.
//
// A clean PDF-pattern catalogue. product_type is a SKILL LEVEL ("Beginner",
// "Advanced Beginner", "Intermediate") or empty -- NOT a product kind, so it
// can't be used to classify; the untyped products ("Nona T-shirt Dress",
// "Wyler Hoodie", "Drafting a Child Bodice", ...) are patterns too.
//
// The only non-pattern is "Quilted Jewelry Case - Video Class" (a video class).
// We exclude by NAME with a precise "video class"/"- class"/gift-card regex --
// note "Bookworm Button Up" contains "book" but is a real pattern, so we must
// NOT filter on the bare word "book". "Bundle"/"Pack" -> bundle.
// ---------------------------------------------------------------------------

const STORE = "https://blankslatepatterns.com"

const EXCLUDE_TITLE = /\bvideo class\b|\s[-–—]\s*class\b|\bgift\s*cards?\b/i
const BUNDLE_TITLE = /\b(?:bundle|pack)\b/i

function classify(title: string): ProductKind {
  if (BUNDLE_TITLE.test(title)) return "bundle"
  return "pattern"
}

export const blankSlatePatternsAdapter: DesignerAdapter = {
  slug: "blank-slate-patterns",
  label: "Blank Slate Patterns",
  matchHosts: ["blankslatepatterns.com", "www.blankslatepatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (EXCLUDE_TITLE.test(product.title)) continue
      const name = product.title.replace(/\s+/g, " ").trim()
      if (!name) continue

      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return out
  },
}
