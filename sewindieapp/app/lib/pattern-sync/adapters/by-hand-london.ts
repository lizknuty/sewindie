import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// By Hand London (byhandlondon.com) -- Shopify.
//
// Keep only product_type "Patterns" (52 of 57). That excludes the Gift Card,
// the "Sewing planner", and the untyped "Stitch Festival London 2023 ..."
// printed reprints (event one-offs, not catalogue designs).
//
// WITHIN the Patterns type there are still two non-patterns to drop by name:
//   "MADE TO MEASURE book" and "The Bodice Fitting Companion - PDF eBook".
// The "BHL Draft It Yourself - <Name>" products ARE patterns (drafting
// patterns) and are kept; we strip the "BHL Draft It Yourself -" prefix and a
// trailing "Sewing Pattern" for display.
// ---------------------------------------------------------------------------

const STORE = "https://byhandlondon.com"

const IS_PATTERN_TYPE = /patterns/i
const EXCLUDE_TITLE = /\bbook\b|ebook|e-book|\bgift\s*cards?\b|\bplanner\b/i

export function cleanByHandLondonName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/^\s*BHL\s+/i, "")
    .replace(/\bDraft It Yourself\b\s*[-–—]\s*/i, "Draft It Yourself: ")
    .replace(/\s*\bsewing pattern\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").trim()
}

function isPattern(product: ShopifyProduct): boolean {
  if (!IS_PATTERN_TYPE.test(product.product_type ?? "")) return false
  if (EXCLUDE_TITLE.test(product.title)) return false
  return true
}

function classify(title: string): ProductKind {
  return /\b(?:bundle|pack)\b/i.test(title) ? "bundle" : "pattern"
}

export const byHandLondonAdapter: DesignerAdapter = {
  slug: "by-hand-london",
  label: "By Hand London",
  matchHosts: ["byhandlondon.com", "www.byhandlondon.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products) {
      if (!isPattern(product)) continue
      const name = cleanByHandLondonName(product.title)
      if (!name) continue

      out.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(product.title),
        sourceId: String(product.id),
      })
    }

    return out
  },
}
