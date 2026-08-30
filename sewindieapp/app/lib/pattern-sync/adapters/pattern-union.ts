import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency, decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Pattern Union (payhip.com/PatternUnion) -- Payhip storefront. Payhip has no
// public product feed, so we crawl the store page for product links (/b/<id>)
// and fetch each product page, reading its JSON-LD Product node (name, image,
// price) with an og:title / og:image fallback. Payhip does not expose a release
// date, so releaseDate is null. Identity is the Payhip product id.
//
// Every product in this store is a sewing pattern (incl. a few free ones), so
// there is no category filtering; we just skip anything without a resolvable
// name.
// ---------------------------------------------------------------------------

const STORE_URL = "https://payhip.com/PatternUnion"
const PRODUCT_BASE = "https://payhip.com/b/"
const CONCURRENCY = 4

// Collect the unique Payhip product ids linked from the store listing page.
function extractProductIds(html: string): string[] {
  const ids = new Set<string>()
  for (const match of html.matchAll(/\/b\/([A-Za-z0-9]+)/g)) {
    ids.add(match[1])
  }
  return [...ids]
}

export const patternUnionAdapter: DesignerAdapter = {
  slug: "pattern-union",
  label: "Pattern Union",
  matchHosts: ["payhip.com"],
  // The designer "site" is a Payhip store path, not its own host.
  importHosts: ["payhip.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const listing = await fetchText(STORE_URL)
    const ids = extractProductIds(listing)

    const scraped = await mapWithConcurrency(ids, CONCURRENCY, async (id): Promise<ScrapedPattern | null> => {
      const url = `${PRODUCT_BASE}${id}`
      let html: string
      try {
        html = await fetchText(url)
      } catch {
        return null
      }
      const ld = jsonLdProduct(html)
      const name = ld?.name ?? metaContent(html, "og:title") ?? metaContent(html, "twitter:title")
      if (!name) return null
      const image = ld?.image ?? metaContent(html, "og:image")
      return {
        name: decodeEntities(name),
        url,
        imageUrl: image ?? null,
        releaseDate: null,
        kind: "pattern",
        sourceId: id,
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
