import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency, decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Ready to Sew (readytosew.fr) -- PrestaShop, English via /en/.
//
// Same shape as the Pauline Alice adapter: PrestaShop has no public JSON feed,
// so we crawl the pattern category listings and fetch each product page,
// deduping by the numeric product id at the start of every product-URL slug
// (a product is linked from several category pages). Each product page exposes
// og:title + og:image (and usually a JSON-LD Product node).
//
// og:title carries a marketing tail after an en dash and a " | <store>" suffix
// ("Jean-Paul Boilersuit - Workwear Sewing Pattern, Sizes 0 to 20 | Ready to
// Sew") -> keep the part before the first " - "/" | ". Expansion-pack products
// are genuine standalone patterns, so they are kept. No reliable release date.
// ---------------------------------------------------------------------------

const BASE = "https://readytosew.fr/en"
const CONCURRENCY = 4
const MAX_CATEGORY_PAGES = 5

const PATTERN_CATEGORIES = [
  "5-shop-sewing-patterns",
  "10-shop-womens-sewing-patterns",
  "11-kids-sewing-patterns",
]

// A PrestaShop product URL: .../en/<category-slug>/<id>-<name-slug>.html
const PRODUCT_URL_RE = /https:\/\/readytosew\.fr\/en\/[^"'\s]+?\/(\d+)-[^"'\/\s]+\.html/gi

async function discoverProducts(): Promise<Map<string, string>> {
  const byId = new Map<string, string>()
  for (const category of PATTERN_CATEGORIES) {
    let previousPageHtml = ""
    for (let page = 1; page <= MAX_CATEGORY_PAGES; page++) {
      let html: string
      try {
        html = await fetchText(`${BASE}/${category}?page=${page}`)
      } catch {
        break
      }
      // PrestaShop echoes page 1 when the requested page is out of range.
      if (page > 1 && html === previousPageHtml) break
      previousPageHtml = html

      const matches = [...html.matchAll(PRODUCT_URL_RE)]
      if (matches.length === 0) break
      let added = 0
      for (const match of matches) {
        const [url, id] = [match[0], match[1]]
        if (!byId.has(id)) {
          byId.set(id, url)
          added++
        }
      }
      if (added === 0) break
    }
  }
  return byId
}

// "Jean-Paul Boilersuit - Workwear Sewing Pattern, Sizes 0 to 20 | Ready to Sew"
// -> "Jean-Paul Boilersuit". Cut the " | <store>" suffix, then the marketing
// clause after the first " - " / " – ".
export function cleanReadyToSewName(title: string): string {
  let t = decodeEntities((title ?? "").replace(/\s+/g, " ").trim())
  t = t.split("|")[0]?.trim() ?? t
  t = t.split(/\s+[-–—]\s+/)[0]?.trim() ?? t
  return t
}

export const readyToSewAdapter: DesignerAdapter = {
  slug: "ready-to-sew",
  label: "Ready to Sew",
  matchHosts: ["readytosew.fr", "www.readytosew.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await discoverProducts()
    const entries = [...products.entries()]

    const scraped = await mapWithConcurrency(entries, CONCURRENCY, async ([id, url]): Promise<ScrapedPattern | null> => {
      let html: string
      try {
        html = await fetchText(url)
      } catch {
        return null
      }
      const ld = jsonLdProduct(html)
      const rawName = ld?.name ?? metaContent(html, "og:title")
      if (!rawName) return null
      const name = cleanReadyToSewName(rawName)
      if (!name) return null
      const image = ld?.image ?? metaContent(html, "og:image")
      return {
        name,
        url,
        imageUrl: image ?? null,
        releaseDate: ld?.date ?? null,
        kind: "pattern",
        sourceId: id,
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
