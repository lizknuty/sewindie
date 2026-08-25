import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Grasser runs Bitrix, which exposes no JSON feed, no WooCommerce/Shopify API
// and no YML export -- so this adapter reads the HTML listing pages. Everything
// below was measured against the live site rather than assumed.
//
// Verified shape (1013 products):
//   - Listing cards carry name, image and a Bitrix element id. There is no
//     release date anywhere in the listing, and the sitemap's <lastmod> tracks
//     page edits rather than publication, so `releaseDate` is always null. Every
//     one of the 660 rows already in the catalogue also has a null release date.
//   - Page size is fixed at 6. SIZEN_1, count, limit and SHOWALL_1 were all
//     tried and all still return 6, so the page count is unavoidably high.
//   - The main listing covers 990 products. The remaining 23 live only in
//     `patterns-50-cents`, which the main listing excludes. Crawling both gives
//     exactly the 1013 products in the sitemap, with nothing left over.
//   - Card hrefs are already the canonical URLs: all 990 matched the sitemap's
//     <loc> exactly, so there is no need to fetch the sitemap to canonicalise.

const ORIGIN = "https://en-grasser.com"

// Both listings are required for full coverage; neither is a superset.
const LISTINGS = [`${ORIGIN}/vykrojki/all-patterns/`, `${ORIGIN}/vykrojki/patterns-50-cents/`]

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const REQUEST_TIMEOUT_MS = 25_000
// 169 pages measured at 24s with this many workers, inside the route's 60s cap.
const CONCURRENCY = 6
// Safety valve. The real count is 165 + 4; this leaves room to grow without
// letting a malformed pager spin us indefinitely.
const MAX_PAGES_PER_LISTING = 400

/**
 * Cyrillic homoglyphs. The site's copy is translated from Russian and some
 * entries still carry Cyrillic letters that look Latin -- "Bra with а gathered
 * edges" uses U+0430, and the catalogue stores the Latin "a". Without this the
 * name would never match the existing row.
 */
const HOMOGLYPHS: Record<string, string> = {
  а: "a", е: "e", о: "o", с: "c", р: "p", х: "x", у: "y", к: "k", м: "m", т: "t", в: "b", н: "h", і: "i", ѕ: "s",
  А: "A", Е: "E", О: "O", С: "C", Р: "P", Х: "X", У: "Y", К: "K", М: "M", Т: "T", В: "B", Н: "H", І: "I",
}

type Card = { url: string; slug: string; name: string; imageUrl: string | null; sourceId: string }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;|&laquo;|&raquo;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Capitalises every word, including small ones -- the catalogue stores
 * "Neck Tab And Bow Tie", not "Neck Tab and Bow Tie". */
function titleCase(input: string): string {
  return input
    .split(/(\s+|-)/)
    .map((token) => (/^[\s-]+$/.test(token) ? token : token.charAt(0).toUpperCase() + token.slice(1)))
    .join("")
}

/** The final path segment, which is this store's stable identity. */
export function grasserSlug(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url.trim(), ORIGIN)
    if (parsed.hostname.toLowerCase().replace(/^www\./, "") !== "en-grasser.com") return null
    const segments = parsed.pathname.split("/").filter(Boolean)
    // Product pages are /vykrojki/<category>/<slug>/ -- anything shallower is a
    // listing or category page and has no product identity.
    if (segments.length < 3) return null
    return segments[segments.length - 1].toLowerCase() || null
  } catch {
    return null
  }
}

/**
 * Turns a listing title into the catalogue's naming convention.
 *
 * The site is inconsistent about the number suffix; all of these occur:
 *   "Dress, pattern №93"  "Trousers, patterns №1008"
 *   "Girl's jumpsuit, pattern, №660"  "Skirt pattern, №594"
 *   "Pants for pregnant women, №471"
 * All normalise to "<Thing>, Pattern No. <n>", preserving a plural "Patterns".
 *
 * "Free" comes from the product's own slug rather than its category: the
 * 50-cents category mixes 14 rows the catalogue labels "Free Pattern" with 5 it
 * does not, and the slug is what distinguishes them.
 *
 * Measured at 654 exact matches out of the 657 rows this could be checked
 * against. The 3 remainders are hand-edits in the catalogue (a stray double
 * space, two "Free" labels the slug contradicts), and all 3 still match on slug.
 */
export function grasserName(rawTitle: string, slug: string): string {
  const cleaned = decodeEntities(rawTitle)
    .replace(/[\u0400-\u04FF]/g, (ch) => HOMOGLYPHS[ch] ?? ch)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim()

  const withNoun = cleaned.match(/^(.*?)[,\s]*\b(patterns?)\b[,\s]*№\s*(\S+)$/i)
  const bareNumber = withNoun ? null : cleaned.match(/^(.*?)[,\s]*№\s*(\S+)$/)
  const match = withNoun ?? bareNumber
  if (!match) return titleCase(cleaned)

  const head = match[1].replace(/[,\s]+$/, "")
  const noun = withNoun && withNoun[2].toLowerCase() === "patterns" ? "Patterns" : "Pattern"
  const number = match[match.length - 1]
  const free = /(^|-)free-patterns?(-|$)/.test(slug) ? "Free " : ""

  return `${titleCase(head)}, ${free}${noun} No. ${number}`
}

/** Anything the store files under patterns that isn't one. */
function classify(name: string, slug: string): ProductKind {
  if (/stencil/i.test(name) || /stencil/i.test(slug)) return "other"
  return "pattern"
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Grasser returned ${res.status} for ${url}`)
  return await res.text()
}

/**
 * Pulls the product cards out of a listing page. Splitting on the card wrapper
 * keeps each product's fields together, so a missing image can't be picked up
 * from the next card along.
 */
function parseCards(html: string): Card[] {
  const cards: Card[] = []

  for (const chunk of html.split(/<div class="card /).slice(1)) {
    const href = chunk.match(/href="(\/vykrojki\/[^"?]+\/)"/)?.[1]
    const rawName = chunk.match(/class="card__description"[^>]*>([^<]+)</)?.[1]
    if (!href || !rawName) continue

    const slug = grasserSlug(href)
    if (!slug) continue

    const name = grasserName(rawName, slug)
    if (!name) continue

    const image = chunk.match(/<img[^>]+src="(\/upload\/[^"]+)"/)?.[1]
    const id = chunk.match(/data-item="(\d+)"/)?.[1]

    cards.push({
      url: `${ORIGIN}${href}`,
      slug,
      name,
      imageUrl: image ? `${ORIGIN}${image}` : null,
      // Falls back to the slug so a React key is always available.
      sourceId: id ?? slug,
    })
  }

  return cards
}

/** Highest page number in the pager, which is how we learn where to stop. */
function pagerMax(html: string): number {
  const seen = [...html.matchAll(/PAGEN_1=(\d+)/g)].map((m) => Number(m[1])).filter(Number.isFinite)
  return seen.length ? Math.min(Math.max(...seen), MAX_PAGES_PER_LISTING) : 1
}

/**
 * Crawls one listing to its end.
 *
 * The page count has to come from the pager: requesting a page past the end
 * does NOT return an empty page, it silently wraps around and serves page 1
 * again (verified -- page 166 and page 200 both return the newest 6 products).
 * A "keep going until empty" loop would therefore never terminate.
 */
async function crawlListing(base: string, into: Map<string, Card>): Promise<void> {
  const firstHtml = await getHtml(base)
  for (const card of parseCards(firstHtml)) {
    if (!into.has(card.slug)) into.set(card.slug, card)
  }

  const lastPage = pagerMax(firstHtml)
  if (lastPage <= 1) return

  const queue: number[] = []
  for (let page = 2; page <= lastPage; page++) queue.push(page)

  let failures = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const page = queue.shift()
        if (page === undefined) return
        try {
          const html = await getHtml(`${base}?PAGEN_1=${page}`)
          for (const card of parseCards(html)) {
            if (!into.has(card.slug)) into.set(card.slug, card)
          }
        } catch {
          // One flaky page shouldn't sink the whole scan, but a wholesale
          // failure (site down, layout change) must not look like a small
          // catalogue -- that would report hundreds of patterns as missing.
          failures++
          if (failures > 15) throw new Error("Grasser listing pages repeatedly failed to load")
        }
        await sleep(60)
      }
    }),
  )
}

export const grasserAdapter: DesignerAdapter = {
  slug: "grasser",
  label: "Grasser",
  matchHosts: ["en-grasser.com", "www.en-grasser.com"],

  // Grasser links one pattern from several category paths and has changed which
  // path is canonical over time, leaving the catalogue's stored URLs split
  // across two forms for the same pattern. The trailing slug is stable across
  // both (verified unique across all 1013 products), so it is identity here.
  identityKey(url) {
    return grasserSlug(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const bySlug = new Map<string, Card>()

    for (const listing of LISTINGS) {
      await crawlListing(listing, bySlug)
    }

    if (bySlug.size === 0) {
      throw new Error("Grasser returned no products -- the listing markup may have changed")
    }

    return [...bySlug.values()].map((card) => ({
      name: card.name,
      url: card.url,
      imageUrl: card.imageUrl,
      // Not exposed anywhere in the store; see the note at the top of the file.
      releaseDate: null,
      kind: classify(card.name, card.slug),
      sourceId: card.sourceId,
    }))
  },
}
