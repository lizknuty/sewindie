import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Folkwear
// ---------------------------------------------------------------------------
// Shopify storefront, so `/products.json` works the same way it does for
// Violette Field Threads: patterns live at `/collections/all/products/<handle>`
// (the long form the catalogue stores, NOT the bare `/products/<handle>` shape),
// and `normalizeUrl` compares the full path, so that prefix is load-bearing --
// measured against the database it scores 142 existing / 224 new, while
// `/products/` scores 0 existing / 366 new.
//
// Folkwear is unlike every Shopify store here so far: it is a full general
// craft shop, not a pattern-only catalogue. The 366 products break down as 163
// "Patterns", 101 "Fabric", 22 "New Arrivals" (all fabric), 24 empty (fabric,
// kits and two sales-tax line items), 19 "Accessories", 12 "Kit", plus thread,
// supplies, hardware, finished "Clothing" and a gift card. Four things follow
// from that.
//
//  1. THIS FILTERS BY product_type -- the opposite of the VFT adapter, which
//     keeps everything because that store sells nothing but patterns. Here the
//     signal is trustworthy in the inclusion direction: all 142 existing rows
//     that still match resolve to product_type "Patterns", 100% of them. So the
//     keep-set is the three product_types that denote a pattern:
//       - "Patterns"        (163) -- the bulk of the catalogue;
//       - "sewing pattern"  (1)   -- "254 Swing Coat", a real numbered Folkwear
//                                    pattern the store simply typed differently;
//       - "knitting pattern"(1)   -- "234 Cameos", likewise.
//     That yields 165 patterns. Everything else -- fabric, kits, thread,
//     supplies, hardware, accessories, finished garments ("Folkwear Clothing -
//     Hapi Jacket"), the gift card and the tax line items -- is dropped. An
//     inclusion filter is used rather than an exclusion list because the
//     non-pattern types are open-ended (a general shop adds new merch
//     categories over time) whereas "what counts as a pattern" is stable.
//
//  2. TITLES ARE VERBATIM. 24 matched rows differ from the store only by
//     capitalisation, and the database holds the damaged form every time --
//     "116 Shirts Of Russia" against the store's "116 Shirts of Russia",
//     "112 Japanese Field Clothing - Pdf" against "... - PDF", "129a" against
//     the correct "129A". That is the same title-casing damage seen on the
//     Greenstyle, VFT, Peek-a-Boo and Ellie and Mac rows, so titles are passed
//     through exactly as the store gives them, only collapsing whitespace.
//
//  3. BUNDLES COME FROM THE TITLE. Eight kept patterns say "Bundle" (the
//     "Basics Patterns Bundle", "Western Wear Bundle", "Maritime Bundle", the
//     "Knitting Pattern Bundle", ...) and nothing carries a bundle tag without
//     also saying so in the title, so the title is the whole signal. Note the
//     store sells the Basics bundle twice -- once as paper patterns, once as
//     PDFs -- as two separate products with distinct handles, so both are kept.
//
//  4. RELEASE DATE IS LEFT NULL. The store has plainly been migrated onto
//     Shopify (Shopify Collective tags, handles restructured -- "105 Syrian
//     Dress" now lives at `105-syrian-dress`, not the stored `105-syrian-dress
//     -pdf`), so published_at is a migration timestamp, not a release date.
//     That matches every existing Folkwear row, which are all null, and the
//     call the Ellie and Mac and Brindille & Twig adapters make on this
//     platform.
// ---------------------------------------------------------------------------

const STORE = "https://www.folkwear.com"
const PRODUCTS_PATH = "/collections/all/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// The catalogue is ~366 products (2 pages today); 12 leaves headroom while
// making an upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// product_type values that denote a sewing/knitting pattern -- see note 1.
// Compared case-insensitively.
const PATTERN_PRODUCT_TYPES = new Set(["patterns", "sewing pattern", "knitting pattern"])

// Bundle detection: the title is the whole signal here -- see note 3.
const BUNDLE_TITLE = /\bbundles?\b/i

type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  tags?: string[]
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
    throw new Error(`Folkwear returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const folkwearAdapter: DesignerAdapter = {
  slug: "folkwear",
  label: "Folkwear",
  matchHosts: ["folkwear.com", "www.folkwear.com"],

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
      // Keep only real patterns -- fabric, kits, supplies etc. are dropped.
      // See note 1.
      if (!PATTERN_PRODUCT_TYPES.has((product.product_type ?? "").trim().toLowerCase())) continue

      // Whitespace collapsed, capitalisation left exactly as the store has it --
      // see note 2.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      // The `/collections/all/products/` shape, matching the catalogue.
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
