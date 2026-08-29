import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Bara Studio
// ---------------------------------------------------------------------------
// A German/Czech pattern company on Shopify, reconciling against 91 existing
// rows. The store is multilingual; the `/en/products.json` feed returns the
// English catalogue (with English titles for the add-on products), no auth.
// Verified shape (~863 products across all types, 1 page of 250 -> several):
//   products[].title        -> messy: "e-book shopper Mira ", "Tote Bag Emma",
//                              "E-book Mantel Selma " (trailing spaces, mixed
//                              case, token in varying positions, some German)
//   products[].handle       -> slug, often German ("e-book-bluse-adela")
//   products[].product_type -> "E-book" | "E-Book" | "E-book " | "add on" |
//                              "Stoffe"/"fabrics"/"Accesories"/"Hidden"/...
//   products[].images[0].src-> image URL
//
// Four decisions define this adapter.
//
//  1. PATTERNS ARE THE E-BOOK AND ADD-ON TYPES. Of ~863 products the store is
//     mostly fabric (Stoffe/fabrics ~500), accessories, DIY sets and Hidden
//     rows -- none of which are patterns. The sewing patterns are the ~51
//     "E-book" products plus the ~7 "add on" products (garment add-ons like
//     cuffs, pockets, plus a needle-marker freebie). Both type spellings are
//     fragmented ("E-book"/"E-Book"/"E-book " and "add on"), so the filter is a
//     case-insensitive regex over a trimmed product_type. Everything else --
//     fabric, notions, Hidden -- is excluded. Verified: 55 of the 58 matched
//     existing rows by handle; the other 36 existing rows are discontinued
//     printed-paper patterns no longer sold on the store (expected drift).
//
//  2. IDENTITY IS THE HANDLE, NOT THE FULL URL. The 91 existing rows are stored
//     under `/en/collections/schnittmuster/products/<handle>`, which the store
//     now 302-redirects to `/collections/schnittmuster/products/<handle>`. The
//     bare `/products/<handle>` form is the one that resolves 200, so new rows
//     use it, and the stable trailing handle is identity -- the situation
//     `identityKey` exists for (cf. Grasser, Green Pepper).
//
//  3. TITLES ARE NORMALISED. Feed titles are inconsistent, so they are cleaned:
//     whitespace collapsed, any e-book token rewritten to "E-Book", Title Case
//     applied, and an "E-Book" prefix added to E-book-type products whose title
//     lacks the token ("Tote Bag Emma" -> "E-Book Tote Bag Emma"), matching the
//     dominant convention in the existing rows. Since matching is by handle,
//     not title (see decision 2), cosmetic title drift never fragments identity
//     -- this is purely so new rows and the review UI read cleanly. Two newer
//     e-books have untranslated German titles the /en feed doesn't localise
//     ("Hundebett Leni"); those are kept as-is with the "E-Book" prefix.
//
//  4. RELEASE DATE IS NULL. published_at clusters on batch-migration days
//     (10 products share 2021-11-26, 6 share 2021-05-29, ...), so it is a
//     migration timestamp, not a release date, and is dropped.
// ---------------------------------------------------------------------------

// Bare host for the canonical product URL (see decision 2). The catalogue is
// fetched from the /en locale path for English titles (see FEED_PATH).
const STORE = "https://www.bara-studio.com"
const FEED_PATH = "/en"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 10
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

/** product_type values that hold sewing patterns. See decision 1. */
const EBOOK_TYPE = /e-?book/i
const ADDON_TYPE = /add[\s-]?on/i

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// The trailing handle: the last non-empty path segment, lower-cased. Stable
// across the /en/collections and bare /products forms. See decision 2.
export function baraHandle(url: string | null | undefined): string | null {
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

/** Capitalises each space- and hyphen-delimited part; lowercases the rest. */
function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
        .join("-"),
    )
    .join(" ")
}

/**
 * Cleans a feed title. See decision 3: collapse whitespace, rewrite any e-book
 * token to a canonical "E-Book", Title Case, then prefix "E-Book" for E-book
 * products whose title never mentioned it.
 */
export function normalizeBaraTitle(rawTitle: string, productType: string): string {
  const collapsed = (rawTitle ?? "").replace(/\s+/g, " ").trim()
  const hadToken = EBOOK_TYPE.test(collapsed)
  const isEbook = EBOOK_TYPE.test(productType ?? "")

  let name = titleCase(collapsed.replace(/e-?book/gi, "E-Book"))
  if (isEbook && !hadToken) name = `E-Book ${name}`.trim()
  return name
}

function classify(productType: string, title: string): ProductKind {
  if (/\bbundles?\b/i.test(title)) return "bundle"
  if (ADDON_TYPE.test(productType) || /\badd-?ons?\b/i.test(title)) return "addon"
  return "pattern"
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE}${FEED_PATH}/products.json?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Bara Studio returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const baraStudioAdapter: DesignerAdapter = {
  slug: "bara-studio",
  label: "Bara Studio",
  matchHosts: ["bara-studio.com", "www.bara-studio.com"],

  // Existing rows live under a redirecting /en/collections path; the handle is
  // the only stable identity. See decision 2.
  identityKey(url) {
    return baraHandle(url)
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

    // Keep only the e-book and add-on product types (see decision 1).
    const candidates = products.filter((p) => {
      const type = (p.product_type ?? "").trim()
      return EBOOK_TYPE.test(type) || ADDON_TYPE.test(type)
    })

    const results: ScrapedPattern[] = []

    for (const product of candidates) {
      const productType = (product.product_type ?? "").trim()
      const name = normalizeBaraTitle(product.title ?? "", productType)
      const handle = (product.handle ?? "").trim()
      if (!name || !handle) continue

      results.push({
        name,
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: null, // Shopify migration timestamps, not release dates -- see decision 4
        kind: classify(productType, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
