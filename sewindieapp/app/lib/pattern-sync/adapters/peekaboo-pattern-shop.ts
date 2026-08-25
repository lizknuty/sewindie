import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Peek-a-Boo Pattern Shop runs on BigCommerce (Stencil), so there is no
// `/products.json`. Verified live: `/products.json` 404s, the Storefront REST
// endpoint `/api/storefront/products` 404s, and `/graphql` returns 405 without a
// store token. The store's own RSS feed (`/rss.php?type=rss`) carries only the
// 10 newest products, so it can't drive a full sync either.
//
// What does work is the category listing with an explicit page size. The
// `/sewing-patterns/` category is the store's catch-all, and `?limit=100` turns
// the full catalogue into 5 requests instead of 431 -- the card markup already
// carries the canonical href, title, image and BigCommerce product id, so
// product pages are never fetched. Measured at 8.5s for the whole crawl.
//
// Four details are specific enough to this store to be worth spelling out.
//
//  1. THE APEX/WWW SPLIT IS ALREADY HANDLED. All 375 existing rows are stored on
//     the apex host (`peekaboopatternshop.com`), while the listing and sitemap
//     both use `www`. The apex form 308-redirects to `www`, so `www` is the
//     canonical one and is what gets written. Matching still works because the
//     shared `normalizeUrl` strips a leading `www.` before comparing -- measured
//     against the database, that scores 338 existing / 93 new. This deliberately
//     does NOT use the `identityKey` hook added for Grasser: the hook exists for
//     stores that serve one product under several *paths*, and a bare host
//     difference needs nothing beyond the shared normalizer.
//
//  2. COVERAGE IS EXACT. The listing yields 431 distinct products and the
//     products sitemap lists exactly the same 431 -- zero in one and not the
//     other -- so the single category really is the whole catalogue and no
//     second crawl is needed. Contrast Grasser, where a `patterns-50-cents`
//     category sat outside the main listing.
//
//  3. TITLES ARE VERBATIM. 32 of the 338 matched rows differ from the store only
//     by capitalisation, and in every case the database holds the damaged form:
//     "Adult Og Oversized Tee" against "Adult OG Oversized Tee", "Pjs" against
//     "PJs", "Dress And Romper" against "Dress and Romper". That is the same
//     title-casing damage seen on Greenstyle and Violette Field Threads rows, so
//     titles are passed through exactly as the store gives them -- decoding HTML
//     entities but never re-casing. Note this is the opposite of Grasser, where
//     the catalogue's own convention *was* Title Case and had to be reproduced.
//
//  4. NO RELEASE DATES. All 375 existing rows have `release_date` null, and the
//     listing exposes no date. The products sitemap has no `lastmod` either, and
//     even if it did it would track page edits rather than release. Left null
//     rather than invented.
//
//  5. THE STORE RE-SLUGS PRODUCTS, so the name fallback is load-bearing here in
//     a way it isn't for the other adapters. Of the 93 listings that no URL
//     match can place, only 60 are genuinely new: the other 33 are products
//     whose URL changed while the pattern stayed the same --
//     "kids-raincoat-pattern" -> "kid-s-raincoat-pattern", "sierra-pullover" ->
//     "sierra-pullover-pattern", "paneled-circle-skirt-for-dolly" ->
//     "doll-skirt-pattern-paneled-circle-skirt". Their names are identical, so
//     `comparePatterns` reports POSSIBLE_MATCH and an admin resolves them;
//     importing the unmatched rows wholesale would create 33 duplicates.
//     Note a slug-based `identityKey` would NOT help here and is the wrong
//     instrument: the slugs genuinely differ on both sides, which is exactly
//     what the name fallback is for. Only 4 stored rows are truly gone from the
//     store.

const STORE = "https://www.peekaboopatternshop.com"

// The store's catch-all pattern category -- see note 2.
const CATEGORY_PATH = "/sewing-patterns/"

// A descriptive agent rather than a spoofed browser string, so the store can
// see who is asking and block it if they'd rather not be indexed.
const USER_AGENT = "SewIndieBot/1.0 (+https://sewindie.app; pattern directory indexer)"

// 100 is the largest page size the storefront honours; the catalogue needs 5
// pages today, and 12 leaves room to roughly double while making an upstream
// pagination bug impossible to turn into an infinite loop.
const PER_PAGE = 100
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 30_000
const PAGE_DELAY_MS = 400

type Card = {
  url: string
  title: string
  imageUrl: string | null
  productId: string | null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Decodes the HTML entities the storefront emits in card titles. Apostrophes
 * arrive as `&#x27;` on roughly a third of the catalogue ("Girl&#x27;s Babydoll
 * Top Pattern"), and an undecoded title would never match the stored row.
 */
export function decodeEntities(value: string): string {
  return value
    .replace(/&(?:apos|#39|#x27);/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    // Ampersand last, so "&amp;#39;" can't decode into an apostrophe.
    .replace(/&amp;/gi, "&")
}

/**
 * Flags anything that isn't a standalone pattern.
 *
 * Bundles are checked first to match the convention in the other adapters, even
 * though this store currently sells none -- nothing here says "bundle" or "pack
 * of N". Worth noting the five add-ons are named "... Add-On Pack", which is why
 * the bundle test requires an explicit count ("pack of 4") rather than the bare
 * word "pack": a looser test would misfile every add-on as a bundle.
 *
 * The two "other" products are a "2026 Sewing Challenge Printable" (a printable
 * chart, not a pattern) and a "Tie Applique Template" (a single pattern piece).
 * "Template" is safe as a signal here because no garment pattern in the
 * catalogue uses the word.
 */
export function classify(title: string): ProductKind {
  if (/\bbundles?\b/i.test(title) || /\b(?:collection|pack|set)\s+of\s+\d+/i.test(title)) {
    return "bundle"
  }

  // "Adult Hoodie Add-On Pack", "Gloria Circle Skirt Add-On".
  if (/\badd-?ons?\b/i.test(title)) return "addon"

  if (/\bprintable\b/i.test(title) || /\btemplate\b/i.test(title)) return "other"

  return "pattern"
}

/**
 * Pulls the product cards out of one listing page.
 *
 * Splitting on `<li class="product">` keeps each card's fields together, so a
 * missing image on one card can't pick up the next card's image. The href and
 * title are both read from the `card-title` heading rather than the image link,
 * because that anchor is the product link on every card whether or not the card
 * has a sale flag, review badge or quick-view button in front of it.
 */
function parseCards(html: string): Card[] {
  const cards: Card[] = []

  for (const block of html.split(/<li class="product"?[^>]*>/).slice(1)) {
    const titleMatch = block.match(/class="card-title"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!titleMatch) continue

    const rawUrl = titleMatch[1].trim()
    const title = decodeEntities(titleMatch[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
    if (!rawUrl || !title) continue

    // Images are lazy-loaded, but Stencil still populates `src` with the real
    // 250x250 thumbnail; `data-src` is checked first in case that changes.
    const imageUrl =
      block.match(/data-src="(https:\/\/cdn11\.bigcommerce\.com[^"]+)"/)?.[1] ??
      block.match(/<img[^>]+src="(https:\/\/cdn11\.bigcommerce\.com[^"]+)"/)?.[1] ??
      null

    // The quick-view button carries the real BigCommerce product id. Falling
    // back to the image path (`/products/<id>/<imageId>/`) covers a card that
    // somehow lacks the button; both resolve to the same id.
    const productId =
      block.match(/data-product-id="(\d+)"/)?.[1] ?? block.match(/\/products\/(\d+)\/\d+\//)?.[1] ?? null

    let url: string
    try {
      const parsed = new URL(rawUrl, STORE)
      // Force the canonical host -- see note 1.
      url = `${STORE}${parsed.pathname}`
    } catch {
      continue
    }

    cards.push({ url, title, imageUrl, productId })
  }

  return cards
}

async function fetchPage(page: number): Promise<Card[]> {
  const url = `${STORE}${CATEGORY_PATH}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Peek-a-Boo Pattern Shop returned ${res.status} for ${url}`)
  }

  return parseCards(await res.text())
}

export const peekabooPatternShopAdapter: DesignerAdapter = {
  slug: "peekaboo-pattern-shop",
  label: "Peek-A-Boo Patterns",
  matchHosts: ["peekaboopatternshop.com", "www.peekaboopatternshop.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    // Keyed by URL so a product appearing on two pages can't be emitted twice.
    const seen = new Map<string, Card>()

    for (let page = 1; page <= MAX_PAGES; page++) {
      const cards = await fetchPage(page)
      if (cards.length === 0) break

      const before = seen.size
      for (const card of cards) {
        if (!seen.has(card.url)) seen.set(card.url, card)
      }

      // Page 6 comes back empty today, so the check above is what normally ends
      // the loop. This second guard is for the failure mode Grasser actually
      // exhibits -- an out-of-range page silently re-serving page 1 -- which
      // would otherwise spin until MAX_PAGES on every sync.
      if (seen.size === before) break
      if (cards.length < PER_PAGE) break

      await sleep(PAGE_DELAY_MS)
    }

    return [...seen.values()].map((card) => ({
      name: card.title,
      url: card.url,
      imageUrl: card.imageUrl,
      // No date is exposed anywhere -- see note 4.
      releaseDate: null,
      kind: classify(card.title),
      sourceId: card.productId ?? card.url.split("/").filter(Boolean).pop() ?? card.url,
    }))
  },
}
