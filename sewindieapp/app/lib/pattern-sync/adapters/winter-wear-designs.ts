import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Winter Wear Designs (winterweardesigns.com) -- Shopify.
//
// A messy catalogue: product_type is unreliable (27 items untyped, others typed
// by garment), so classification is by NAME. The store mixes PDF sewing
// patterns with vinyl/heat-transfer (HTV) freebies and a gift card. Rules:
//   - EXCLUDE the gift card and pure HTV / cut-file products ("12 Days Free
//     HTV", "HTV Collection ...", "Christmas HTV Designs", "... cut files").
//     These are vinyl design downloads, not sewing patterns. A product that is
//     a sewing pattern AND ships bonus HTV ("Wine Bottle Gift Bag - Free
//     Pattern and HTV") is kept -- it says "Pattern".
//   - "Add On"/"Add-On" expansions -> addon (need a base pattern).
//   - "Bundle" -> bundle.
//   - everything else -> pattern, including the many "Free with Code" garment
//     patterns (the promo is not a product-kind distinction). Promo/size tails
//     are stripped from the display name.
// Release date from published_at.
// ---------------------------------------------------------------------------

const STORE = "https://www.winterweardesigns.com"

const GIFT = /gift\s*card/i
// Pure vinyl/HTV/cut-file products (exclude), but NOT a pattern that merely
// bundles bonus HTV (those contain the word "Pattern").
const HTV_PRODUCT = /\bhtv\b|cut files?\b|vinyl/i
const ADDON = /\badd[-\s]?on\b/i
const BUNDLE = /\bbundle\b/i

// Strip promo suffixes and size ranges so titles read as the design name:
//   "Boxy Tee size XXS-5X"                          -> "Boxy Tee"
//   "Cross Hem Tee for Women size 00-24 - FREE ..." -> "Cross Hem Tee for Women"
//   "Split Hem Tee for Kids size 1-16 (Free ...)"   -> "Split Hem Tee for Kids"
export function cleanWinterWearName(title: string): string {
  let name = title ?? ""
  // Drop parenthetical promos: "(Free with code)", "(free w/ code, see inside)"
  name = name.replace(/\s*\([^)]*\bfree\b[^)]*\)\s*/gi, " ")
  // Drop trailing "- FREE ...", ": Free with Code", "Free with Code" tails
  name = name.replace(/\s*[-–—:]\s*free\b.*$/i, "")
  name = name.replace(/\s*\bfree with code\b.*$/i, "")
  // Drop size ranges: "size XXS-5X", "size 00-24", "for girls size 1-16"
  name = name.replace(/\s+size[s]?\s+[0-9a-z]+\s*[-–]\s*[0-9a-z]+.*$/i, "")
  name = name.replace(/\s+size[s]?\s+[0-9a-z]+\+?\b.*$/i, "")
  return name.replace(/\s+/g, " ").trim() || (title ?? "").trim()
}

function isExcluded(product: ShopifyProduct): boolean {
  const title = product.title ?? ""
  if (GIFT.test(title) || GIFT.test(product.product_type ?? "")) return true
  // Exclude HTV/vinyl products UNLESS they're a sewing pattern shipping bonus HTV.
  if (HTV_PRODUCT.test(title) && !/\bpattern\b/i.test(title)) return true
  return false
}

function classify(title: string): ScrapedPattern["kind"] {
  if (ADDON.test(title)) return "addon"
  if (BUNDLE.test(title)) return "bundle"
  return "pattern"
}

export const winterWearDesignsAdapter: DesignerAdapter = {
  slug: "winter-wear-designs",
  label: "Winter Wear Designs",
  matchHosts: ["winterweardesigns.com", "www.winterweardesigns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const out: ScrapedPattern[] = []

    for (const product of products) {
      if (isExcluded(product)) continue
      const name = cleanWinterWearName(product.title)
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
