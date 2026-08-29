import type { DesignerAdapter, ScrapedPattern, ProductKind } from "../types"

// Sinclair Patterns -- https://sinclairpatterns.com (Shopify)
//
// A knit-focused pattern house. Unlike a general craft store, essentially the
// whole catalogue is sewing patterns; the storefront simply merchandises them
// into garment product_types (Tops, Bottoms, Dresses, Hoodies, Skirts, Kids,
// Sleeves, Rompers). The adapter therefore keeps everything and excludes only
// the single non-pattern product -- the "Gift card" product_type.
//
// Field notes gathered against the live store + catalogue (designer_id 114,
// 147 existing rows):
//
//  1. URL SHAPE is /collections/all-patterns/products/<handle> -- NOT the bare
//     /products/<handle> most Shopify adapters use, and not the
//     /collections/all/products/ shape Folkwear/VFT/Brindille use. All 147
//     existing rows match on this path and 0 on the other two, so it is
//     load-bearing. normalizeUrl() in compare.ts strips the ?_pos/_fid tracking
//     query the catalogue stored, so clean URLs still match.
//
//  2. TITLES ARE PASSED THROUGH VERBATIM. The store is the good source here:
//     "Adele knit boatneck top (PDF)". The catalogue holds a damaged
//     Title-Cased form with "(Pdf)" ("Adele Knit Boatneck Top (Pdf)"), so 140
//     of 147 rows differ by casing only. Since all 147 match by URL, casing
//     never affects the existing/new split -- verbatim just means the ~29 new
//     rows import in the store's own (correct) casing instead of inheriting the
//     catalogue's damage.
//
//  3. RELEASE DATE left null. published_at is dominated by a 2020-08 migration
//     batch (19 products on 2020-08-15 alone), so it is a store-migration date,
//     not a pattern release date. All 147 existing rows already have null
//     release_date, so null keeps the adapter consistent with the catalogue.
//
//  4. CLASSIFICATION. Six products are explicit "ADD-ON ... add-on pack"
//     sleeve/skirt extensions for other patterns -- flagged as `addon`. One
//     "... bundle" is flagged as `bundle`. Everything else is a standalone
//     `pattern`.

const STORE = "https://sinclairpatterns.com"
const PRODUCTS_PATH = "/collections/all-patterns/products"

// The lone non-pattern product_type to drop -- see note above.
const EXCLUDE_TYPES = new Set(["gift card"])

const BUNDLE_TITLE = /\bbundle\b/i
// Sinclair labels extension packs with a leading "ADD-ON" and the phrase
// "add-on pack"; the sixth ("... Flared skirts for Valley skater dress") is
// also a leading-ADD-ON extension. Anchor to the start so a normal pattern that
// merely mentions add-ons in prose is never misclassified.
const ADDON_TITLE = /^add-?on\b/i

function classify(title: string): ProductKind {
  if (BUNDLE_TITLE.test(title)) return "bundle"
  if (ADDON_TITLE.test(title)) return "addon"
  return "pattern"
}

interface ShopifyProduct {
  handle: string
  title: string
  product_type: string
  images?: { src: string }[]
}

export const sinclairPatternsAdapter: DesignerAdapter = {
  slug: "sinclair-patterns",
  label: "Sinclair Patterns",
  matchHosts: ["sinclairpatterns.com", "www.sinclairpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const out: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (let page = 1; page <= 12; page++) {
      const res = await fetch(`${STORE}/products.json?limit=250&page=${page}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`Sinclair products.json page ${page} -> HTTP ${res.status}`)

      const body = (await res.json()) as { products?: ShopifyProduct[] }
      const products = body.products ?? []
      if (products.length === 0) break

      for (const product of products) {
        // Drop the gift card -- the only non-pattern product. See note 1.
        if (EXCLUDE_TYPES.has((product.product_type ?? "").toLowerCase())) continue

        const name = (product.title ?? "").trim()
        if (!name || !product.handle) continue

        // De-dupe defensively in case pagination overlaps.
        if (seen.has(product.handle)) continue
        seen.add(product.handle)

        out.push({
          name,
          url: `${STORE}${PRODUCTS_PATH}/${product.handle}`,
          imageUrl: product.images?.[0]?.src ?? null,
          releaseDate: null,
          kind: classify(name),
          sourceId: product.handle,
        })
      }

      if (products.length < 250) break
    }

    return out
  },
}

// Exported for the verify script's unit tests.
export { classify }
