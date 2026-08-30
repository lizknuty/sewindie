import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Puff and Pencil (puffandpencil.com) -- Shopify. Two quirks:
//
// 1. FORMAT PAIRS: nearly every product ends with a "(PDF)" or "(PAPER)" token
//    ("SLASH DRESS (PDF)" + "SLASH DRESS (PAPER)"). These are one design in two
//    formats -> collapse by the title with the token stripped. PDF wins as
//    canonical. 149 raw products -> ~114 stems before other filtering.
//
// 2. The "(PDF)" token is NOT a pattern signal -- modular add-ons carry it too.
//    So classification is driven by product_type, not the parenthetical:
//      - cpb_product / symønster / (none)  -> full garment patterns (keep)
//      - Sleeve / Collar                   -> modular add-ons (EXCLUDE, 24)
//      - cpb_hybrid                         -> "DESIGN YOUR OWN PATTERN" builder
//                                              tool + "test" junk (EXCLUDE)
//    Plus name-based excludes for FABRIC PACKAGE, Gift Card, Digital Sewing
//    Planner, and literal "test" listings.
//
// "Bundle …Pack" titles are flagged as bundles. published_at is a real date.
// ---------------------------------------------------------------------------

const STORE = "https://puffandpencil.com"

// product_type values that are NOT standalone patterns.
const EXCLUDED_TYPES = new Set(["sleeve", "collar", "cpb_hybrid"])
// name-based excludes (fabric, gift cards, planners, junk test products).
const EXCLUDED_NAME = /fabric package|gift card|digital sewing planner|^test$/i

// The (PDF)/(PAPER) token is usually a trailing suffix but occasionally sits
// mid-title ("PJ PANTS (PDF) - WOMEN'S AND MEN'S"), so strip it anywhere.
const FORMAT_TOKEN = /\s*\((pdf|paper)\)\s*/gi
const IS_PDF = /\(pdf\)/i
const BUNDLE = /\bbundle\b|\bpattern pack\b/i

// Remove the (PDF)/(PAPER) format token wherever it appears; tidy separators.
function stripFormat(title: string): string {
  return (title ?? "")
    .replace(FORMAT_TOKEN, " ")
    .replace(/\s*[-–]\s*$/, "") // trailing dash left after a mid-strip
    .replace(/\s+/g, " ")
    .trim()
}

export function puffCollapseKey(title: string): string {
  return stripFormat(title).toLowerCase()
}

// Display name: strip the format token, tidy an "- WOMEN'S AND MEN'S" style
// trailing qualifier is KEPT (it is a real audience distinction). Titles are
// left in the brand's own casing.
export function cleanPuffName(title: string): string {
  return stripFormat(title) || (title ?? "").trim()
}

export const puffAndPencilAdapter: DesignerAdapter = {
  slug: "puff-and-pencil",
  label: "Puff and Pencil",
  matchHosts: ["puffandpencil.com", "www.puffandpencil.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)

    // First pass: keep only real pattern products.
    const patterns = products.filter((p) => {
      const type = (p.product_type ?? "").trim().toLowerCase()
      if (EXCLUDED_TYPES.has(type)) return false
      if (EXCLUDED_NAME.test(p.title ?? "")) return false
      return true
    })

    // Second pass: collapse (PDF)/(PAPER) format pairs, PDF canonical.
    const byKey = new Map<string, { product: (typeof patterns)[number]; isPdf: boolean }>()
    for (const product of patterns) {
      const key = puffCollapseKey(product.title)
      const isPdf = IS_PDF.test(product.title ?? "")
      const existing = byKey.get(key)
      if (!existing || (isPdf && !existing.isPdf)) {
        byKey.set(key, { product, isPdf })
      }
    }

    const results: ScrapedPattern[] = []
    for (const { product } of byKey.values()) {
      const name = cleanPuffName(product.title)
      if (!name) continue
      const image = product.images?.[0]?.src ?? null
      const kind: ProductKind = BUNDLE.test(product.title ?? "") ? "bundle" : "pattern"
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: image,
        releaseDate: product.published_at ?? null,
        kind,
        sourceId: String(product.id),
      })
    }
    return results
  },
}
