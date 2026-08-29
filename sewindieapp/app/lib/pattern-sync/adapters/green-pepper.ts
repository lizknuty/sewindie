import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// The Green Pepper
// ---------------------------------------------------------------------------
// An outdoor-gear pattern company on Shopify, reconciling against 107 existing
// rows. The public `/products.json` feed works with no auth. Verified shape
// (~266 products, 134 of product_type "Patterns", 1 page at 250):
//   products[].title        -> "116 – Men's Cross Country or Jogging Suit Pattern"
//   products[].handle       -> slug for the product URL
//   products[].product_type -> "Patterns" | "Hardware" | "Fabric" | "thread" | ...
//   products[].tags         -> e.g. ["kit"], ["How to","PDF"], ["PDF"]
//   products[].images[0].src-> image URL
//
// Three decisions define this adapter.
//
//  1. IDENTITY IS THE HANDLE, NOT THE FULL URL. The 107 existing rows store the
//     same product under SIX different collection path prefixes
//     (/collections/patterns/products/, /collections/patterns-for-adults/...,
//     /collections/packs-bags-misc/..., a few bare /products/, etc.) because a
//     product's URL changes with whichever collection it was linked from. The
//     trailing handle is stable across all of them and matched all 107 rows, so
//     it is identity here -- exactly the situation `identityKey` exists for (cf.
//     Grasser). New rows are written with the bare /products/<handle> form,
//     which is collection-independent and therefore stable.
//
//  2. "PATTERNS" TYPE, BUT KITS AND HOW-TOS ARE FLAGGED. The store files real
//     sewing patterns under product_type "Patterns", so that is the filter. But
//     it also files two kinds of non-pattern under the same type: hardware /
//     notions / material KITS ("552 Wave Bag Hardware Kit", "528 Norwester Hat
//     Kit" -- the physical hardware to go with a pattern, tagged "kit") and
//     HOW-TO tutorials ("How To: Fanny Pack", tagged "How to"). These are
//     classified "other" so the admin sees them flagged rather than silently
//     imported as patterns. Crucially, NOT ending in the word "Pattern" is NOT
//     used as a signal: many genuine patterns don't ("514 – Men's Blue Mountain
//     Jacket", "301 – Pacific Crest Gaiters", "207 – Adult Overmitts").
//
//  3. RELEASE DATE IS NULL. The store was migrated onto Shopify in one batch --
//     106 of 134 pattern products share published_at 2024-10-16 -- so that date
//     is a migration timestamp, not a release date, and is dropped.
// ---------------------------------------------------------------------------

const STORE = "https://thegreenpepper.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// 1 page covers the current catalogue; 10 leaves room to grow while making an
// upstream pagination bug impossible to turn into an infinite loop.
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

/** Shopify product_type for real sewing patterns; everything else is merch. */
const PATTERN_PRODUCT_TYPE = "patterns"

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  tags?: string[]
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Letters and digits only, lowercased -- so "How to" keys as "howto". */
const keyOf = (value: string) => value.replace(/[^\p{L}\d]/gu, "").toLowerCase()

// The trailing handle: the last non-empty path segment, lower-cased. Stable
// across the six collection prefixes the existing rows are split across. See
// decision 1.
export function greenPepperHandle(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const path = new URL(withScheme).pathname.replace(/\/+$/, "")
    const segment = path.split("/").filter(Boolean).pop()
    return segment ? segment.toLowerCase() : null
  } catch {
    return null
  }
}

/**
 * Classifies a listing. The store's own tags are consulted first, then title
 * text, since tagging is inconsistent on older listings. See decision 2.
 */
function classify(product: ShopifyProduct, title: string): ProductKind {
  const tags = (product.tags ?? []).map(keyOf)

  // Tutorials, not patterns: "How To: Fanny Pack" (tagged "How to").
  if (tags.includes("howto") || /^how\s+to\b/i.test(title)) return "other"

  // Hardware / notions / material kits sold to accompany a pattern, e.g.
  // "552 Wave Bag Hardware Kit" (tagged "kit"), "301 Pacific Crest Gaiters
  // Kits" (untagged). These are not sewing patterns.
  if (tags.includes("kit") || /\bkits?\b/i.test(title)) return "other"

  if (/\bbundles?\b/i.test(title)) return "bundle"
  if (/\badd-?ons?\b/i.test(title) || /\bexpansion\b/i.test(title)) return "addon"

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
    throw new Error(`The Green Pepper returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const greenPepperAdapter: DesignerAdapter = {
  slug: "green-pepper",
  label: "The Green Pepper",
  matchHosts: ["thegreenpepper.com", "www.thegreenpepper.com"],

  // The same product is stored under six different collection paths; the handle
  // is the only stable identity. See decision 1.
  identityKey(url) {
    return greenPepperHandle(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    // Trust the store's own product_type to separate patterns from hardware,
    // fabric and thread -- but if nothing matches (a renamed type upstream),
    // keep everything rather than silently reporting an empty catalogue.
    const patternsOnly = products.filter((p) => (p.product_type ?? "").trim().toLowerCase() === PATTERN_PRODUCT_TYPE)
    const candidates = patternsOnly.length > 0 ? patternsOnly : products

    const results: ScrapedPattern[] = []

    for (const product of candidates) {
      // Titles are already correctly cased and carry the store's number prefix
      // ("116 – Men's ... Pattern"); kept verbatim, only whitespace collapsed.
      const name = (product.title ?? "").replace(/\s+/g, " ").trim()
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: null, // Shopify migration timestamps, not release dates -- see decision 3
        kind: classify(product, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
