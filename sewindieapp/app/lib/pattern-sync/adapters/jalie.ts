import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Jalie runs on Shopify, which exposes a public `/products.json` feed. No auth,
// no HTML scraping.
//
// Verified shape (263 products, 259 of type "Sewing Patterns", 2 pages at 250):
//   products[].title        -> "4452 // BARBARA Underwear set"
//   products[].handle       -> slug for the product URL
//   products[].images[0].src-> image URL
//   products[].published_at -> release date
//   products[].product_type -> "Sewing Patterns" | "Gift card" | "Label" | ...
//   products[].tags         -> includes "format_Add-On/Expansion Pack"
//
// The wrinkle specific to Jalie is naming. Every store title carries a pattern
// number and a shouty design name -- "4452 // BARBARA Underwear set" -- while
// the SewIndie catalogue stores "Barbara Underwear Set". So the title is
// stripped of its number prefix and title-cased to match.

const STORE = "https://jalie.com"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
// 2 pages covers the current catalogue; 8 leaves room to grow while making a
// pagination bug upstream impossible to turn into an infinite loop.
const MAX_PAGES = 8
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

/** Shopify product_type for real sewing patterns; everything else is merch. */
const PATTERN_PRODUCT_TYPE = "sewing patterns"

/**
 * Leading pattern number: "4452 // ", "4671a // ", "4455AM // ", "4237a4 // ".
 * Also tolerates the double space seen in "4241 //  JOCELYNE Polo dress".
 */
const NUMBER_PREFIX = /^\s*\d{3,4}[\p{L}\d]*\s*\/\/\s*/u

/**
 * The "0000 // Discontinued Jalie Patterns" listing is a single catch-all page
 * covering many retired patterns, not a pattern in its own right.
 */
const CATCH_ALL_PREFIX = /^\s*0{3,4}\s*\/\//

/** Acronyms that must survive title-casing rather than becoming "Pdf"/"Pj". */
const ACRONYMS = new Set(["PDF", "PJ"])

/** Kept lowercase mid-title. Stored without punctuation, so "n'" matches as "n". */
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "n", "nor", "of", "on", "or", "the", "to", "with",
])

/** Kept lowercase inside hyphenated compounds: "2-in-1", "Off-the-Shoulder". */
const SMALL_HYPHEN_PARTS = new Set(["a", "and", "in", "of", "on", "ons", "the", "to"])

type ShopifyProduct = {
  id: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string | null
  tags?: string[]
  images?: Array<{ src?: string }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const hasLetter = (value: string) => /\p{L}/u.test(value)

/** Letters and digits only, lowercased -- so "(add-on)" keys as "addon". */
const keyOf = (value: string) => value.replace(/[^\p{L}\d]/gu, "").toLowerCase()

function capitalizePart(part: string, smallWords: Set<string> | null): string {
  if (!hasLetter(part)) return part

  const key = keyOf(part)
  const letters = part.replace(/[^\p{L}]/gu, "")
  // Only preserve an acronym the store already wrote in caps, so a lowercase
  // "pj" in prose isn't shouted back at the user.
  if (ACRONYMS.has(key.toUpperCase()) && /^\p{Lu}+$/u.test(letters)) return part.toUpperCase()

  const lower = part.toLowerCase()
  if (smallWords?.has(key)) return lower
  // Capitalize the first letter, leaving any leading "(" intact and any letter
  // after an apostrophe alone, so "women's" stays "Women's".
  return lower.replace(/\p{L}/u, (char) => char.toUpperCase())
}

/**
 * Title-cases a store title. Hyphenated compounds are split so "BARBARA" and
 * "MARIE-JOSÉE" both read naturally, while "Half-Zip" and "X-Back" keep their
 * internal capitals.
 */
function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word, wordIndex) =>
      word
        .split("-")
        .map((part, partIndex) =>
          capitalizePart(
            part,
            // The very first word is always capitalized; later words may be
            // small words. Hyphen parts use their own, shorter list.
            partIndex === 0 ? (wordIndex === 0 ? null : SMALL_WORDS) : SMALL_HYPHEN_PARTS,
          ),
        )
        .join("-"),
    )
    .join(" ")
}

/** "4452 // BARBARA Underwear set" -> "Barbara Underwear Set" */
export function cleanJalieName(title: string): string {
  const withoutNumber = title.replace(NUMBER_PREFIX, "").replace(/\s+/g, " ").trim()
  return titleCase(withoutNumber)
}

/**
 * Add-ons are identified by Shopify tag first (the store's own answer) and by
 * title text second, since the tag is missing on a couple of older listings.
 */
function classify(product: ShopifyProduct, title: string): ProductKind {
  const taggedAddon = (product.tags ?? []).some((tag) => keyOf(tag).includes("addon"))
  if (taggedAddon || /\badd-?ons?\b/i.test(title)) return "addon"

  // GALAXIE releases are multi-item accessory packs rather than one pattern.
  if (/\bgalaxie\b/i.test(title)) return "bundle"

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
    throw new Error(`Jalie returned ${res.status} for ${url}`)
  }

  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

export const jalieAdapter: DesignerAdapter = {
  slug: "jalie",
  label: "Jalie",
  matchHosts: ["jalie.com", "www.jalie.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }

    // Trust the store's own product_type to separate patterns from gift cards
    // and notions -- but if nothing matches (a renamed type upstream), keep
    // everything rather than silently reporting an empty catalogue.
    const patternsOnly = products.filter((p) => (p.product_type ?? "").trim().toLowerCase() === PATTERN_PRODUCT_TYPE)
    const candidates = patternsOnly.length > 0 ? patternsOnly : products

    const results: ScrapedPattern[] = []

    for (const product of candidates) {
      const title = (product.title ?? "").trim()
      const handle = (product.handle ?? "").trim()
      if (!title || !handle) continue

      // Skip the single "discontinued patterns" catch-all listing.
      if (CATCH_ALL_PREFIX.test(title)) continue

      const name = cleanJalieName(title)
      if (!name) continue

      results.push({
        name,
        url: `${STORE}/products/${handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(product, title),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
