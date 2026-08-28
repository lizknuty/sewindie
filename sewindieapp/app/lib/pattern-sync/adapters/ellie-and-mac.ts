import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Ellie and Mac runs on Shopify, so `/products.json` works the same way it does
// for Jalie, Greenstyle and Violette Field Threads. Verified live: 660 products
// across 3 pages at limit=250, every one with a title, handle and image.
//
// Four details are specific enough to this store to be worth spelling out.
//
//  1. product_type IS TRUSTWORTHY HERE, and load-bearing. The 660 products break
//     down as 372 "Sewing Pattern", 167 "Cutting File", 118 "Embroidery", plus a
//     course and two gift cards. Only the 372 sewing patterns belong in a
//     pattern directory -- the cutting files (Cricut/Silhouette SVGs) and
//     embroidery designs are a different craft, not patterns. So this is the
//     opposite call from Violette Field Threads, where `product_type` was noise
//     and everything was kept: here the field cleanly separates three product
//     lines and the filter is exact. Measured against the database, the 372
//     sewing patterns score 311 existing / 61 new; not one of the 322 stored
//     rows resolves to a cutting file or embroidery product, so the filter never
//     hides a row the catalogue already trusts.
//
//  2. URL SHAPE is the bare `/products/<handle>`, NOT the
//     `/collections/all/products/<handle>` form Violette Field Threads and
//     Brindille & Twig store. All 311 matched rows are stored this way, so this
//     is the shape that agrees with the catalogue. (Shopify serves the product
//     at both, but only the stored shape matches without re-import.)
//
//  3. TITLES ARE VERBATIM. Of the 311 matched rows only 2 differ from the store,
//     and in both cases the database holds the damaged form -- "Adult Classic Pj
//     & Nightgown Pattern" against the store's "PJ", "Breezy Dress Pattern
//     (Adult)" against "(adult)". That is the same title-casing damage seen on
//     Greenstyle, Violette Field Threads and Peek-a-Boo rows, so titles are
//     passed through exactly as the store gives them -- decoding HTML entities
//     but never re-casing.
//
//  4. NO RELEASE DATES. All 322 existing rows have `release_date` null. Shopify
//     does expose `published_at` on every product, but it is the store-publish
//     timestamp, not a pattern release date, and it carries migration noise (a
//     single 2018-10-07 stamp covers 24 unrelated products). Rather than invent
//     a date dimension this designer's catalogue has never had -- and risk a
//     migration batch sorting itself to the top of "newest" -- it is left null,
//     matching every existing row. Contrast Violette Field Threads, whose
//     catalogue already carried real dates worth preserving.

const STORE = "https://www.ellieandmac.com"

// The store's own product line for garment patterns -- see note 1. Cutting files
// and embroidery are filed under their own types and are not patterns.
const PATTERN_PRODUCT_TYPE = "sewing pattern"

const USER_AGENT = "SewIndieBot/1.0 (+https://sewindie.app; pattern directory indexer)"

const PER_PAGE = 250
// The catalogue needs 3 pages today; 12 leaves room to grow while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Flags anything that isn't a single standalone pattern. This store sells no
 * add-ons, so there are only two outcomes: bundle or pattern.
 *
 * A bundle here is any multi-pattern purchase, which the store names four ways:
 * "... Bundle" / "... Bundle Pack" (the bulk of them), "... Capsule" (a curated
 * wardrobe set), "Starter Pack", and one "... Collection: N ... Patterns". The
 * `\bpack of \d+\b` / `\bset of \d+\b` arms match nothing today and exist only
 * to mirror the other adapters' conventions.
 *
 * Two traps this deliberately avoids:
 *  - A bare `\bpack\b` would misfile "Shyra Chic Backpack Purse" and "Pack Your
 *    Bag Backpack" as bundles, so only "Starter Pack" / "Bundle Pack" (the
 *    latter via the Bundle arm) count -- never the word "pack" alone.
 *  - "Bundle Pack" is caught by the Bundle arm, so it needs no special case.
 */
export function classify(title: string): ProductKind {
  if (
    /\bbundles?\b/i.test(title) ||
    /\bcapsule\b/i.test(title) ||
    /\bstarter pack\b/i.test(title) ||
    /\bcollection\b/i.test(title) ||
    /\b(?:pack|set)\s+of\s+\d+\b/i.test(title)
  ) {
    return "bundle"
  }
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Ellie and Mac returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const ellieAndMacAdapter: DesignerAdapter = {
  slug: "ellie-and-mac",
  label: "Ellie and Mac",
  matchHosts: ["ellieandmac.com", "www.ellieandmac.com"],

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

    for (const product of products) {
      // Keep only garment patterns -- cutting files and embroidery are a
      // different craft. See note 1.
      if ((product.product_type ?? "").trim().toLowerCase() !== PATTERN_PRODUCT_TYPE) continue

      // Whitespace collapsed, capitalisation left exactly as the store has it --
      // see note 3.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        // The bare `/products/` shape, not `/collections/all/products/` -- note 2.
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
        // Store exposes only a noisy publish timestamp; left null -- see note 4.
        releaseDate: null,
        kind: classify(name),
        sourceId: String(product.id ?? handle),
      })
    }

    return results
  },
}
