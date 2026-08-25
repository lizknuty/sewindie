import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Seamwork is the first designer here with no product feed at all. The site is a
// bespoke Rails app: there is no /products.json, no /wp-json, and robots.txt
// disallows /shop and /search. The catalogue index at /pdf-sewing-patterns IS
// allowed, so that is what this adapter reads -- 21 pages of ~20 cards rather
// than 430 individual product pages.
//
// Verified card shape (430 unique products across 21 pages):
//   <li data-bookmarkable-type="Product" data-bookmarkable-id="1234" ...>
//     <div class="product-preview product--thumbnail-pattern">
//       <a href="/pdf-sewing-patterns/zinnia-pleated-skirt"><img src="..."></a>
//       <h3><a href="/pdf-sewing-patterns/zinnia-pleated-skirt">Zinnia Skirt</a></h3>
//
// Three things worth knowing about this store:
//
//  1. Two names per pattern. The card link text is short ("Zinnia Skirt") while
//     the product page title is descriptive ("Zinnia Pleated Skirt"). All 262
//     existing catalogue rows use the SHORT form, so the card text is what gets
//     stored -- which is also why the index alone is enough and no per-product
//     request is needed.
//
//  2. Bonus patterns. 125 of the 430 are free member variations of a design
//     that is also sold on its own ("Rosemary Placket Front Dress Bonus"). The
//     catalogue holds none of these today, so they are flagged as "bonus" and
//     left unchecked in the UI rather than silently doubling the catalogue.
//
//  3. No release dates. Neither the card nor the product page exposes one (no
//     JSON-LD, no og: date, no visible "released" text), so releaseDate is null
//     for every row -- matching the 262 existing rows, none of which has a date.

const STORE_ORIGIN = "https://www.seamwork.com"
const CATALOGUE_PATH = "/pdf-sewing-patterns"

// 21 pages covers the current catalogue. The cap makes a pagination change
// upstream impossible to turn into an unbounded crawl.
const MAX_PAGES = 60
const REQUEST_TIMEOUT_MS = 25_000
const PAGE_DELAY_MS = 250

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

/**
 * The store's own class for a card that is a sewing pattern. Used as a filter
 * when present so non-pattern merchandise can never be mistaken for a pattern.
 */
const PATTERN_CARD_CLASS = "product--thumbnail-pattern"

type Card = {
  sourceId: string
  slug: string
  name: string
  imageUrl: string | null
  isPatternCard: boolean
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Minimal entity decode -- card text contains &amp; and the odd &#39;. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * A "bonus" is a free variation of a design that is also sold separately. The
 * store marks these two ways -- a `-bonus` slug suffix and a "Bonus" name
 * suffix -- and all 125 agree on both. Either signal is accepted so a change to
 * one of them upstream cannot quietly turn 125 flagged rows into imports.
 */
function classify(slug: string, name: string): ProductKind {
  if (/-bonus$/i.test(slug) || /\bbonus$/i.test(name)) return "bonus"
  return "pattern"
}

/** Pulls the product cards out of one catalogue index page. */
function parseCards(html: string): Card[] {
  const cards: Card[] = []

  // Each product is one <li data-bookmarkable-type="Product">. Splitting on
  // that boundary keeps every field read scoped to a single card, so a missing
  // image on one card can't pick up the next card's image.
  const chunks = html.split(/<li[^>]*data-bookmarkable-type="Product"/i).slice(1)

  for (const chunk of chunks) {
    const href = chunk.match(/href="(\/pdf-sewing-patterns\/[a-z0-9][a-z0-9-]*)"/i)?.[1]
    if (!href) continue

    const slug = href.split("/").filter(Boolean).pop() ?? ""
    if (!slug) continue

    // The <h3> link text is the short catalogue name the existing rows use.
    const heading = chunk.match(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
    const name = decodeEntities(stripTags(heading ?? ""))
    if (!name) continue

    const rawImage = chunk.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null

    cards.push({
      sourceId: chunk.match(/data-bookmarkable-id="(\d+)"/i)?.[1] ?? slug,
      slug,
      name,
      imageUrl: rawImage ? absoluteUrl(decodeEntities(rawImage)) : null,
      isPatternCard: new RegExp(PATTERN_CARD_CLASS, "i").test(chunk),
    })
  }

  return cards
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ")
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("//")) return `https:${value}`
  return `${STORE_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`
}

async function fetchPage(page: number): Promise<string> {
  const url = `${STORE_ORIGIN}${CATALOGUE_PATH}?page=${page}`
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Seamwork returned ${response.status} for page ${page}`)
  }
  return response.text()
}

async function fetchCatalogue(): Promise<ScrapedPattern[]> {
  // Keyed by slug: Rails pagination serves the last page again for an
  // out-of-range page number, so "no new slugs" is the reliable stop signal
  // rather than trusting a page to come back empty.
  const bySlug = new Map<string, Card>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const cards = parseCards(await fetchPage(page))
    if (cards.length === 0) break

    let added = 0
    for (const card of cards) {
      if (bySlug.has(card.slug)) continue
      bySlug.set(card.slug, card)
      added++
    }
    if (added === 0) break

    await sleep(PAGE_DELAY_MS)
  }

  const cards = [...bySlug.values()]

  // Prefer the store's own "is a pattern" class, but if the markup changes and
  // nothing matches, keep every card rather than reporting an empty catalogue.
  const patternCards = cards.filter((card) => card.isPatternCard)
  const selected = patternCards.length > 0 ? patternCards : cards

  return selected.map((card) => ({
    name: card.name,
    url: `${STORE_ORIGIN}${CATALOGUE_PATH}/${card.slug}`,
    imageUrl: card.imageUrl,
    // Not exposed anywhere on the site -- see note 3 at the top of this file.
    releaseDate: null,
    kind: classify(card.slug, card.name),
    sourceId: card.sourceId,
  }))
}

export const seamworkAdapter: DesignerAdapter = {
  slug: "seamwork",
  label: "Seamwork",
  matchHosts: ["seamwork.com", "www.seamwork.com"],
  fetchCatalogue,
}
