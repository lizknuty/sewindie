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
// Wix throttles bursty crawls (returning partial/challenge pages that lack the
// image), so keep concurrency low and lean on the per-product retry below.
const CONCURRENCY = 2

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

// Strip the trailing "(PDF )PATTERN" descriptor while preserving the store's
// ALL-CAPS product styling. "TEMPLATE" is part of the product identity (e.g.
// "GARLAND SHAPE TEMPLATE") so it is kept.
export function cleanRoseName(name: string): string {
  return (name ?? "")
    .replace(/\s*\bpdf\s+pattern\s*$/i, "")
    .replace(/\s*\bpdf\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Wix serves product imagery from static.wixstatic.com; use it as a fallback
// when a transient fetch misses the og:image/JSON-LD image. The match may be
// protocol-relative or bare, so callers normalize it to an absolute URL.
function wixStaticImage(html: string): string | null {
  const m = html.match(/(?:https?:)?\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_.~/-]+\.(?:jpg|jpeg|png|webp)/i)
  return m ? m[0] : null
}

// Force an image reference to an absolute https URL (Wix/JSON-LD values are
// sometimes protocol-relative "//..." or scheme-less "static.wixstatic.com/…").
function absoluteImage(src: string | null | undefined): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  if (trimmed.startsWith("static.wixstatic.com")) return `https://${trimmed}`
  return null
}

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

// Product slug from a Wix product-page URL (stable id): drop any query/hash,
// then take the last path segment.
function slugOf(url: string): string {
  const path = url.replace(/[#?].*$/, "")
  return path.split("/").filter(Boolean).pop() ?? url
}

export const roseCaldwellAdapter: DesignerAdapter = {
  slug: "rose-caldwell",
  label: "Rose Caldwell",
  matchHosts: ["rosiecaldwell.com", "www.rosiecaldwell.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const urls = await discoverProductUrls()

    const scraped = await mapWithConcurrency(urls, CONCURRENCY, async (url): Promise<ScrapedPattern | null> => {
      // Under heavy concurrency Wix occasionally serves a partial/challenge page
      // that lacks the image (or name). Re-fetch once when the extracted data is
      // incomplete before giving up.
      const extract = (html: string) => {
        const ld = jsonLdProduct(html)
        const rawName = ld?.name ?? metaContent(html, "og:title")?.replace(/\s*\|\s*Rosie Caldwell\s*$/i, "").trim()
        const description = ld?.description ?? metaContent(html, "og:description") ?? ""
        const imageUrl = absoluteImage(ld?.image ?? metaContent(html, "og:image") ?? wixStaticImage(html))
        return { rawName, description, imageUrl }
      }

      let data: ReturnType<typeof extract> | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt))
        let html: string
        try {
          html = await fetchText(url)
        } catch {
          continue
        }
        data = extract(html)
        if (data.rawName && data.imageUrl) break
      }
      if (!data || !data.rawName) return null
      if (!isRosePattern(data.rawName, data.description)) return null

      return {
        name: cleanRoseName(data.rawName),
        url,
        imageUrl: data.imageUrl ?? null,
        releaseDate: null,
        kind: BUNDLE.test(data.rawName) ? "bundle" : "pattern",
        sourceId: slugOf(url),
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
