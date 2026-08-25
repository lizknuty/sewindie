import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Violette Field Threads runs on Shopify, so `/products.json` works the same way
// it does for Jalie and Greenstyle. Verified live: 1089 products across 5 pages,
// every one with a title, handle and image.
//
// This is the first adapter to run against a designer that is already almost
// fully imported -- 1075 of the catalogue's rows are VFT -- so it is a genuine
// sync rather than a backfill. That changes which details matter, and three of
// them are specific enough to this store to be worth spelling out.
//
//  1. URL SHAPE. Every one of the 1075 existing rows is stored as
//     `/collections/all/products/<handle>`, not the `/products/<handle>` form
//     every other adapter here emits. `normalizeUrl` compares the full path, so
//     emitting the conventional shape would make all 1075 rows look brand new
//     and offer the whole catalogue for re-import. Measured both ways against
//     the database: `/products/` scored 0 existing / 1089 new, while
//     `/collections/all/products/` scored 1043 existing / 46 new. Both shapes
//     return 200 on the live store, so this one is chosen purely to agree with
//     the data already in the catalogue.
//
//  2. NO product_type FILTER. Greenstyle and Fibre Mood can trust
//     `product_type` to separate patterns from merch. Here it is unreliable:
//     1067 "PDF", 3 lowercase "pdf", 11 empty, 5 "Bundle", 2 "Accessory
//     Patterns" and 1 "Dress". A case-insensitive `pdf` filter would silently
//     drop 19 real patterns ("Posie Girls Top & Dress" among them); a
//     case-sensitive one would drop 22. The store sells nothing but patterns,
//     so everything is kept and the odd non-pattern is flagged by `classify`
//     instead.
//
//  3. TITLES ARE VERBATIM. 79 existing rows differ from the store only by
//     capitalisation -- "Complete Bundle Of 3" in the database against
//     "Complete Bundle of 3" upstream -- the same title-casing damage that
//     turned "PDF" into "Pdf" on Greenstyle rows. Titles are stored exactly as
//     the store gives them so this adapter cannot add more of it.

const STORE = "https://violettefieldthreads.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// The catalogue needs 5 pages today; 12 leaves room to grow while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string | null
  tags?: string[]
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Letters and digits only, lowercased -- so "Add-On" keys as "addon". */
const keyOf = (value: string) => value.replace(/[^\p{L}\d]/gu, "").toLowerCase()

/**
 * The design name a product belongs to: the first word of the title, minus a
 * "FREE"/"NEW" prefix. Used only to tell a coordinated release apart from a
 * migration batch (see `resolveReleaseDates`), never for matching.
 */
function familyOf(title: string): string {
  const withoutPrefix = title.replace(/^\s*(?:free|new)\s+/i, "").trim()
  return keyOf(withoutPrefix.split(/[\s&]+/)[0] ?? "")
}

/**
 * Flags anything that isn't a single standalone pattern.
 *
 * Bundles are checked before add-ons, which matters for exactly one listing:
 * "Blithe Maxi Add-on Complete Bundle of 4" is both, and the store's own
 * `bundle` tag is the more useful answer -- it is a multi-pattern purchase.
 *
 * The `bundle` tag is a strict superset of what the title reveals: 321 products
 * carry it against 319 whose titles say so, and nothing says "bundle" in its
 * title without also being tagged. Both signals are still consulted so a
 * missing tag upstream can't quietly turn a bundle into a standalone pattern.
 */
function classify(product: ShopifyProduct, title: string): ProductKind {
  const tags = product.tags ?? []

  const taggedBundle = tags.some((tag) => keyOf(tag).includes("bundle"))
  // "Complete Bundle of 3", "Girls + Misses Bundle", "Complete Flower
  // Collection of 12", "Starter Pack of 18" Doll Patterns".
  if (taggedBundle || /\bbundles?\b/i.test(title) || /\b(?:collection|pack)\s+of\s+\d+/i.test(title)) {
    return "bundle"
  }

  // "Molly Girls Hood Add-on", "Clover Doll Dress Add-on" -- needs the base
  // pattern bought separately. Note "Blithe Girls Maxi Add-On" capitalises the
  // O, hence the case-insensitive test.
  if (/\badd-?ons?\b/i.test(title)) return "addon"

  return "pattern"
}

/**
 * Decides which `published_at` values are real release dates.
 *
 * Shared timestamps mean opposite things in this store depending on what shares
 * them, so "shared means bogus" -- the rule that suited a smaller catalogue --
 * would be wrong here in both directions:
 *
 *  - A coordinated release publishes one design's size range seconds apart.
 *    Gardenia went out at 08:46:46, :47, :48 and :49; Colette's four listings
 *    share a single second. These are real and worth keeping.
 *  - A migration batch stamps unrelated designs identically. 2017-11-21T23:33:52
 *    covers ten products across the Blithe, Clementine, Gemma, Ellie and Clover
 *    families, and the oldest stamp of all, 2012-02-16T16:50:00, covers nine.
 *    These are storage artefacts and would invent release dates.
 *
 * So the test is whether everything sharing a timestamp belongs to one design
 * family. That keeps 909 dates and discards 180, and every one of the 46
 * currently-new rows keeps a real date.
 */
/**
 * Belonging to one family is necessary but not sufficient: a lone product with a
 * corrupt stamp passes the family test trivially, since a set of one is always
 * consistent. Nothing in the store trips this today (0 future-dated, oldest is
 * the 2012 launch), so this is purely a guard against a scheduled or mistyped
 * publish date arriving later and sorting itself to the top of "newest".
 */
function isPlausible(stamp: string): boolean {
  const at = new Date(stamp).getTime()
  if (Number.isNaN(at)) return false
  // The business has no patterns predating its 2012 launch.
  if (at < Date.UTC(2011, 0, 1)) return false
  return at <= Date.now()
}

function resolveReleaseDates(products: ShopifyProduct[]): Map<ShopifyProduct, string | null> {
  const byStamp = new Map<string, ShopifyProduct[]>()
  for (const product of products) {
    const stamp = product.published_at
    if (!stamp) continue
    const bucket = byStamp.get(stamp)
    if (bucket) bucket.push(product)
    else byStamp.set(stamp, [product])
  }

  const resolved = new Map<ShopifyProduct, string | null>()
  for (const product of products) {
    const stamp = product.published_at
    if (!stamp) {
      resolved.set(product, null)
      continue
    }
    const sharers = byStamp.get(stamp) ?? [product]
    const families = new Set(sharers.map((item) => familyOf(item.title ?? "")))
    resolved.set(product, families.size <= 1 && isPlausible(stamp) ? stamp : null)
  }
  return resolved
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Violette Field Threads returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const violetteFieldThreadsAdapter: DesignerAdapter = {
  slug: "violette-field-threads",
  label: "Violette Field Threads",
  matchHosts: ["violettefieldthreads.com", "www.violettefieldthreads.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    const releaseDates = resolveReleaseDates(products)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      // Whitespace is collapsed but capitalisation is left exactly as the store
      // has it -- see note 3 at the top of this file.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        // The `/collections/all/` prefix is deliberate -- see note 1.
        url: `${STORE}/collections/all/products/${handle}`,
        imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
        releaseDate: releaseDates.get(product) ?? null,
        kind: classify(product, name),
        sourceId: String(product.id ?? handle),
      })
    }

    return results
  },
}
