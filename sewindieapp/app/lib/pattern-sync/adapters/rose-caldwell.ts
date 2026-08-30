import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Rose Caldwell / Rosie Caldwell (rosiecaldwell.com) -- Wix Stores.
//
// Wix has no public product JSON feed, but it publishes a store product sitemap
// at /store-products-sitemap.xml listing every product page URL. We crawl that,
// then fetch each product page which exposes a clean JSON-LD Product node
// (name, image, description) plus og:title/og:image as fallbacks.
//
// The store MIXES PDF sewing patterns with physical handmade goods (quilted
// cushions, handmade stockings), vintage fabric/curtains, and a commercial-use
// licence. Only downloadable patterns belong in SewIndie, so we classify by the
// product DESCRIPTION: a pattern's description advertises a "PDF"/"digital
// download"/"template" (e.g. the free "Garland Shape Template" and the multi-
// pattern bundles), whereas finished goods read "lovingly handmade"/"handmade
// quilted" and never mention a PDF/download. The licence is excluded by name.
// No reliable release date. Identity is the product slug.
// ---------------------------------------------------------------------------

const BASE = "https://www.rosiecaldwell.com"
const PRODUCT_SITEMAP = `${BASE}/store-products-sitemap.xml`
const CONCURRENCY = 4

// Positive signal that a product is a downloadable pattern/template.
const PATTERN_SIGNAL = /\bpdf\b|digital (?:pdf )?(?:pattern|download)|\btemplate\b|\bpatterns?\b/i
// Hard excludes regardless of description: licences and (as a safeguard)
// obvious physical goods keywords.
const EXCLUDED_NAME = /commercial use licence|commercial use license|licen[cs]e for/i
// A finished/physical good: handmade items and vintage textiles. Uses specific
// phrases ("lovingly handmade", "handmade quilted") rather than a bare
// "handmade" so a pattern that merely mentions the word is not excluded.
const PHYSICAL_SIGNAL = /lovingly handmade|handmade quilted|\bvintage\b|curtains?|\bwool\b|twill|cushion cover/i

const BUNDLE = /\bbundle\b/i

// Decide whether a product is a downloadable pattern from its name+description.
export function isRosePattern(name: string, description: string): boolean {
  const haystack = `${name} ${description}`.toLowerCase()
  if (EXCLUDED_NAME.test(name)) return false
  const looksPhysical = PHYSICAL_SIGNAL.test(haystack)
  const looksPattern = PATTERN_SIGNAL.test(haystack)
  // A pattern signal wins only when the item isn't clearly a physical good;
  // physical goods never advertise a PDF/download, so this keeps templates and
  // bundles while dropping handmade cushions, stockings, and vintage fabric.
  return looksPattern && !looksPhysical
}

async function discoverProductUrls(): Promise<string[]> {
  const xml = await fetchText(PRODUCT_SITEMAP)
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  return [...new Set(urls)]
}

// Product slug from a Wix product-page URL (stable id).
function slugOf(url: string): string {
  return url.replace(/[/#?].*$/, "").split("/").filter(Boolean).pop() ?? url
}

export const roseCaldwellAdapter: DesignerAdapter = {
  slug: "rose-caldwell",
  label: "Rose Caldwell",
  matchHosts: ["rosiecaldwell.com", "www.rosiecaldwell.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const urls = await discoverProductUrls()

    const scraped = await mapWithConcurrency(urls, CONCURRENCY, async (url): Promise<ScrapedPattern | null> => {
      let html: string
      try {
        html = await fetchText(url)
      } catch {
        return null
      }
      const ld = jsonLdProduct(html)
      const name = ld?.name ?? metaContent(html, "og:title")?.replace(/\s*\|\s*Rosie Caldwell\s*$/i, "").trim()
      if (!name) return null
      const description = ld?.description ?? metaContent(html, "og:description") ?? ""
      if (!isRosePattern(name, description)) return null

      return {
        name,
        url,
        imageUrl: ld?.image ?? metaContent(html, "og:image") ?? null,
        releaseDate: ld?.date ?? null,
        kind: BUNDLE.test(name) ? "bundle" : "pattern",
        sourceId: slugOf(url),
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
