import type { DesignerAdapter, ScrapedPattern } from "../types"
import { decodeEntities, fetchText, mapWithConcurrency, sleep } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Angela Kane -- https://angelakane.com
//
// A hand-built custom PHP site (NOT Shopify/Woo/Squarespace), all PDF sewing
// patterns (no fabric/notions). There is no product JSON feed, so we crawl the
// XML sitemap for pattern pages and scrape each page's HTML.
//
// Notes learned from recon:
//  - Pattern pages live at /sewing_patterns/patterns/<slug>-<number>.php
//  - The sitemap contains STALE entries: ~5 of 18 listed pages now 404 (a
//    16-byte body). fetchText() throws on 404, so those are skipped naturally.
//  - Name comes from the <h1>; strip a trailing "... PDF Sewing Pattern".
//  - The hero image lives in a per-pattern folder whose name starts with the
//    page's own number, e.g. global_assets/pattern_pics/976-harem-pants/976-...
//    (the first pattern_pics match on a page can be a RELATED-product thumb, so
//    we must match the image folder to THIS page's number).
//  - No add-to-cart / price on the page (purchase is via a members area), so we
//    only capture name + url + image.
// ---------------------------------------------------------------------------

const ORIGIN = "https://angelakane.com"
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`
const PATTERN_PAGE_RE = /\/sewing_patterns\/patterns\/[a-z0-9-]+-\d+\.php$/i

export function cleanAngelaKaneName(h1: string): string {
  return decodeEntities(
    h1
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/^\d+\s+/, "")
    .replace(/\s*[,-]?\s*(?:a\s+)?pdf sewing patterns?\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Resolve the hero image for a page: prefer a pattern_pics image whose folder
// starts with this page's own pattern number, else the first pattern_pics image.
function extractImage(html: string, patternNumber: string): string | null {
  const imgs = [...html.matchAll(/(?:\.\.\/)*global_assets\/pattern_pics\/([^"'\s)]+\.(?:jpg|jpeg|png|webp))/gi)].map(
    (m) => m[1],
  )
  if (imgs.length === 0) return null
  const own = imgs.find((p) => new RegExp(`^${patternNumber}-`).test(p))
  const chosen = own ?? imgs[0]
  return `${ORIGIN}/global_assets/pattern_pics/${chosen}`
}

async function fetchCatalogue(): Promise<ScrapedPattern[]> {
  const sitemap = await fetchText(SITEMAP_URL)
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => PATTERN_PAGE_RE.test(u))
  const unique = [...new Set(urls)]

  const scraped = await mapWithConcurrency(unique, 4, async (url): Promise<ScrapedPattern | null> => {
    let html: string
    try {
      html = await fetchText(url)
    } catch {
      // Stale sitemap entry (404) or transient failure -- skip.
      return null
    }
    await sleep(50)

    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ""
    const name = cleanAngelaKaneName(h1)
    if (!name) return null

    const number = (url.match(/-(\d+)\.php$/) || [])[1] || ""
    const imageUrl = extractImage(html, number)

    return {
      name,
      url,
      imageUrl,
      releaseDate: null,
      kind: "pattern",
      sourceId: number || url,
    }
  })

  return scraped.filter((p): p is ScrapedPattern => p !== null)
}

export const angelaKaneAdapter: DesignerAdapter = {
  slug: "angela-kane",
  label: "Angela Kane",
  matchHosts: ["angelakane.com", "www.angelakane.com"],
  fetchCatalogue,
}
