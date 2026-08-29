import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// George & Ginger
// ---------------------------------------------------------------------------
// Shopify storefront, so `/products.json` works. Unlike Violette Field Threads,
// Brindille & Twig and Folkwear (which store the long
// `/collections/all/products/<handle>` form), George & Ginger stores the BARE
// `/products/<handle>` shape -- the same form Ellie and Mac uses -- and that is
// what the catalogue holds, so the bare shape maps 1:1 onto existing rows:
// measured against the database it scores 108 existing / 0 new with `/products/`
// and 0 existing with `/collections/all/products/`. 108/108 stored rows match.
//
// Four things define this adapter.
//
//  1. IT IS A PATTERN-ONLY SHOP, so the filter is EXCLUSION, not inclusion. Of
//     164 products, 162 have an empty product_type, one is "Tops" (a real
//     pattern -- "The ... Top") and exactly one is a "Gift Card". product_type
//     is therefore useless as an inclusion signal (nearly everything is empty),
//     so the adapter keeps everything EXCEPT the gift card, matched by
//     product_type "Gift Card". This mirrors Brindille & Twig's "not a Gift
//     Card" call rather than Folkwear's include-only-patterns call.
//
//  2. TITLES ARE VERBATIM. All 108 matched rows differ from the store, and the
//     database holds the DAMAGED form every time: "Pdf" for the store's "PDF",
//     "Youtube" for "YouTube", "Batwing" for "BatWing", "40k" for "40K", "Free"
//     for the store's "FREE". The store is the higher-quality source, so titles
//     are passed through exactly as given, only collapsing whitespace -- the
//     same call made for Folkwear, Ellie and Mac and Itch to Stitch.
//
//  3. BUNDLES COME FROM THE TITLE, and "Set" is deliberately NOT a bundle
//     signal. The real multi-pattern products say "Bundle", "Collection" or
//     "Pack" ("The Change It Up Bra Bundle", "The Polar Dress Collection",
//     "Goth Starter Pack Collection"). The 17 products that say "Set" -- "The
//     Unwind Set", "The Romy Set", "The Rave Shirt Set" -- are single garment
//     SETS sold as one pattern, not bundles of separate patterns, so "Set" is
//     excluded from the pattern. (kind is advisory metadata for the review UI;
//     the Pattern table has no kind column and matching never uses it, but it
//     should still be right.)
//
//  4. RELEASE DATE IS LEFT NULL. published_at spans 2017-2026 but carries
//     migration batches (13 products on 2022-12-03, 9 on 2020-10-16, ...), so
//     it is a bulk-import timestamp, not a release date. Every existing G&G row
//     is null, so this stays consistent -- the same call the other Shopify
//     adapters here make.
// ---------------------------------------------------------------------------

const STORE = "https://georgeandgingerpatterns.com"
// The BARE `/products/` shape -- the form the catalogue stores. See header.
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// Catalogue is ~164 products (1 page); 12 leaves headroom while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type values that are not patterns -- see note 1.
const EXCLUDED_PRODUCT_TYPES = new Set(["gift card"])

// Bundle detection: "Bundle", "Collection" and "Pack" are real multi-pattern
// products; "Set" is a single garment set and is intentionally absent -- note 3.
const BUNDLE_TITLE = /\bbundles?\b|\bcollections?\b|\bpack\b/i

type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(title: string): ProductKind {
  return BUNDLE_TITLE.test(title) ? "bundle" : "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`George & Ginger returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const georgeAndGingerAdapter: DesignerAdapter = {
  slug: "george-and-ginger",
  label: "George & Ginger",
  matchHosts: ["georgeandgingerpatterns.com", "www.georgeandgingerpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()

    for (const product of products) {
      // Drop the gift card -- everything else is a pattern. See note 1.
      if (EXCLUDED_PRODUCT_TYPES.has((product.product_type ?? "").trim().toLowerCase())) continue

      // Whitespace collapsed, capitalisation left exactly as the store has it --
      // see note 2.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      // The bare `/products/` shape, matching the catalogue.
      const url = `${STORE}${PRODUCTS_PATH}${handle}`
      if (seen.has(url)) continue
      seen.add(url)

      results.push({
        name,
        url,
        imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
        releaseDate: null, // migration timestamps, not release dates -- see note 4
        kind: classify(name),
        sourceId: String(product.id ?? handle),
      })
    }

    return results
  },
}
