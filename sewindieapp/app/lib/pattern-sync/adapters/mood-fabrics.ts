import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Mood Fabrics publishes its free patterns as blog posts on a WordPress site
// (blog.moodfabrics.com), which exposes a public, unauthenticated WP REST API.
// No HTML scraping needed: the JSON carries the title, canonical link, featured
// image and publish date.
//
// Verified shape (573 posts in the "free-sewing-patterns" category, 6 pages at
// per_page=100):
//   /wp-json/wp/v2/posts?categories=<id>&_embed=wp:featuredmedia&_fields=...,_links
//     title.rendered                              -> name (HTML-encoded)
//     link                                        -> pattern URL (blog.moodfabrics.com/<slug>/)
//     _embedded["wp:featuredmedia"][0].source_url -> image URL
//     date_gmt / date                             -> release date
//     categories                                  -> taxonomy term ids
//
// Two non-obvious traps this adapter handles:
//  1. The category is full of listicle "round-up" posts ("22 FREE Resort Outfit
//     Sewing Patterns...") and the odd tutorial ("How to Create DIY Fabric
//     Plates") that are NOT single patterns. They are flagged kind:"other" (not
//     dropped) so an admin decides -- most are also filed under the
//     "pattern-roundup" category, which we resolve and use as the primary
//     signal, backed by title heuristics.
//  2. The designer record lives on www.moodfabrics.com but patterns live on the
//     blog subdomain, and the old www.moodfabrics.com/blog/<slug>/ URLs
//     301-redirect to blog.moodfabrics.com/<slug>/. identityKey collapses both
//     to the trailing slug so a re-host never looks like a brand-new pattern.

const BASE = "https://blog.moodfabrics.com/wp-json/wp/v2"

// A real browser UA. Some WordPress hosts serve a challenge page to obviously
// scripted clients.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 100
// Safety valve so a pagination bug upstream can't spin us forever. 6 pages is
// the current real count; 12 leaves room for the catalogue to grow.
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000
// Small courtesy gap between page requests.
const PAGE_DELAY_MS = 250

// The category whose posts are the free patterns, and the round-up category
// used to flag listicles. Resolved to term ids at runtime so a renamed/
// re-ordered taxonomy doesn't silently break filtering.
const PATTERNS_CATEGORY_SLUG = "free-sewing-patterns"
const ROUNDUP_CATEGORY_SLUG = "pattern-roundup"

type WpTerm = { id: number; slug: string }

type WpPost = {
  id: number
  date: string | null
  date_gmt: string | null
  link: string
  slug?: string
  title?: { rendered?: string }
  categories?: number[]
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * WordPress returns titles as HTML, so `Boo! – Youth` arrives as
 * `Boo! &#8211; Youth`. Decode the entities WP actually emits, including
 * numeric escapes, so names match what a human sees on the site.
 */
export function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  }

  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => named[entity.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * A Mood free-pattern post is a single garment release, whose title almost
 * always reads "The <Name> Free Sewing Pattern(s)". The category also holds
 * seasonal listicles and the occasional tutorial, which are NOT single
 * patterns. Return "other" for those (they're flagged, not dropped) and
 * "pattern" for everything else.
 *
 * `roundupCategoryId` is the resolved "pattern-roundup" term when available --
 * the strongest signal (it catches the "The 15-Outfit Vacation Capsule: 9 Free
 * Patterns" style round-ups that start with "The" and would otherwise slip
 * through the title heuristics).
 */
export function classify(decodedName: string, categories: number[], roundupCategoryId: number | null): ProductKind {
  if (roundupCategoryId != null && categories.includes(roundupCategoryId)) return "other"

  // Strip a leading quote so a headline like “The Leah Dress” ... still reads
  // as starting with "The".
  const t = decodedName.replace(/^[\s"'\u201c\u2018\u201d\u2019]+/, "")

  if (/^\d/.test(t)) return "other" // "22 FREE Resort Outfit Sewing Patterns..."
  if (/^top\s+\d/i.test(t)) return "other" // "Top 5 Most Downloaded..."
  if (/^(how to|diy|tips\s*&\s*tricks|tips and tricks)\b/i.test(t)) return "other" // tutorials / technique posts
  if (/\btemplate\b/i.test(t) && !/free sewing pattern/i.test(t)) return "other" // "... Free Template & Tutorial"
  // "Free X Patterns for/to Y" listicles -- plural "Patterns", and not a
  // "The <Name> ..." single release.
  if (!/^the\b/i.test(t) && /\bpatterns\b/i.test(t) && /\b(for|to)\b/i.test(t)) return "other"

  return "pattern"
}

async function getJson(url: string): Promise<{ body: unknown; headers: Headers }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Mood Fabrics returned ${res.status} for ${url}`)
  }

  return { body: await res.json(), headers: res.headers }
}

/** Resolves a category term id by slug, or null when the slug isn't found. */
async function fetchCategoryId(slug: string): Promise<number | null> {
  const { body } = await getJson(`${BASE}/categories?slug=${encodeURIComponent(slug)}&_fields=id,slug`)
  const terms = (Array.isArray(body) ? body : []) as WpTerm[]
  return terms.find((t) => t.slug?.toLowerCase() === slug)?.id ?? null
}

async function fetchPosts(categoryId: number): Promise<WpPost[]> {
  const all: WpPost[] = []
  let totalPages = 1

  for (let page = 1; page <= MAX_PAGES; page++) {
    // `_links` must be requested alongside `_embed`, otherwise WordPress can't
    // build `_embedded` and every featured image comes back empty.
    const url =
      `${BASE}/posts?categories=${categoryId}&per_page=${PER_PAGE}&page=${page}` +
      `&_embed=wp:featuredmedia&_fields=id,slug,link,title,date,date_gmt,categories,_links,_embedded` +
      `&orderby=date&order=desc`
    const { body, headers } = await getJson(url)

    if (page === 1) {
      const reported = Number(headers.get("x-wp-totalpages") ?? "1")
      totalPages = Number.isFinite(reported) && reported > 0 ? reported : 1
    }

    const batch = (Array.isArray(body) ? body : []) as WpPost[]
    all.push(...batch)

    if (page >= totalPages || batch.length === 0) break
    await sleep(PAGE_DELAY_MS)
  }

  return all
}

/** Trailing slug of a Mood blog URL, used as a host-independent identity. */
export function moodSlug(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const path = new URL(url).pathname.toLowerCase().replace(/\/+$/, "")
    const slug = path.split("/").filter(Boolean).pop()
    return slug || null
  } catch {
    return null
  }
}

export const moodFabricsAdapter: DesignerAdapter = {
  slug: "mood-fabrics",
  label: "Mood Sewciety",
  // The designer record is www.moodfabrics.com (hostOf strips the www.), so
  // match on the bare apex. NOT blog.moodfabrics.com -- see importHosts.
  matchHosts: ["moodfabrics.com"],
  // Patterns actually live on the blog subdomain, and legacy links use the apex
  // /blog/ path, so allow both when validating imported URLs.
  importHosts: ["blog.moodfabrics.com", "moodfabrics.com"],
  identityKey: moodSlug,

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const patternsCategoryId = await fetchCategoryId(PATTERNS_CATEGORY_SLUG)
    if (patternsCategoryId == null) {
      throw new Error(`Mood Fabrics: could not resolve the "${PATTERNS_CATEGORY_SLUG}" category`)
    }

    const [roundupCategoryId, posts] = await Promise.all([
      fetchCategoryId(ROUNDUP_CATEGORY_SLUG),
      fetchPosts(patternsCategoryId),
    ])

    const results: ScrapedPattern[] = []

    for (const post of posts) {
      const name = decodeEntities(post.title?.rendered ?? "")
      if (!name || !post.link) continue

      const categories = post.categories ?? []
      const releaseDate = post.date_gmt ? `${post.date_gmt}Z` : (post.date ?? null)

      results.push({
        name,
        url: post.link,
        imageUrl: post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
        releaseDate,
        kind: classify(name, categories, roundupCategoryId),
        sourceId: String(post.id),
      })
    }

    return results
  },
}
