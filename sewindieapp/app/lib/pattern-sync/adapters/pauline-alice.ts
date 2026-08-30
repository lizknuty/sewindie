import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency, decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Pauline Alice (paulinealicepatterns.com) -- PrestaShop, English via /en/.
// PrestaShop has no public JSON feed, so we crawl the pattern category listings
// and fetch each product page. Products live under their default-category path
// (e.g. /en/sewing-patterns/110-mila-jumpsuit.html), and the same product is
// linked from several category pages, so we dedupe by the numeric product id
// that PrestaShop puts at the start of every product-URL slug.
//
// Each product page exposes og:title + og:image (and usually a JSON-LD Product
// node). Titles sometimes carry a "(stockists)" suffix (the retail/stockist
// variant) -> stripped. No reliable release date -> releaseDate null. Identity
// is the PrestaShop product id.
// ---------------------------------------------------------------------------

const BASE = "https://www.paulinealicepatterns.com/en"
const CONCURRENCY = 4
const MAX_CATEGORY_PAGES = 5

// The category ids that hold sewing patterns (garment + kids + accessories).
const PATTERN_CATEGORIES = [
  "58-sewing-patterns",
  "61-tops",
  "62-bottoms",
  "64-dresses",
  "65-jackets-coats",
  "66-kids",
  "91-accessories",
]

// A PrestaShop product URL: .../en/<category-slug>/<id>-<name-slug>.html
const PRODUCT_URL_RE = /https:\/\/www\.paulinealicepatterns\.com\/en\/[^"'\s]+?\/(\d+)-[^"'\/\s]+\.html/gi

// Discover unique product URLs (keyed by product id) across every pattern
// category, following PrestaShop's ?page=N pagination.
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
      // Last page reached (no *new* ids) -> stop paginating this category.
      if (added === 0) break
    }
  }
  return byId
}

// "Mila Jumpsuit (stockists)" -> "Mila Jumpsuit"
export function cleanPaulineName(title: string): string {
  return decodeEntities((title ?? "").replace(/\s*\((?:stockists?|pdf)\)\s*$/i, "").trim())
}

export const paulineAliceAdapter: DesignerAdapter = {
  slug: "pauline-alice",
  label: "Pauline Alice",
  matchHosts: ["paulinealicepatterns.com", "www.paulinealicepatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await discoverProducts()
    const entries = [...products.entries()] // [id, url]

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
      const name = cleanPaulineName(rawName)
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
