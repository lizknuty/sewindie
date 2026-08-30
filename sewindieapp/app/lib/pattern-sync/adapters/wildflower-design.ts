import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Wildflower Design (wildflowerdesignpatterns.com) -- Wix Stores.
//
// Same shape as the Rose Caldwell (Wix) adapter: no product JSON feed, but a
// store product sitemap at /store-products-sitemap.xml lists every product
// page, each exposing a JSON-LD Product node (name/image/description) with
// og:title/og:image fallbacks. Wix throttles bursty crawls, so concurrency is
// kept low with a per-product retry.
//
// Small catalogue of PDF sewing patterns. Classification by name:
//   - "... Expansion" (e.g. the Coquelicot pinafore/apron expansion) needs a
//     base pattern -> addon
//   - "Free Digital Download" (the Aster collar) is a free pattern -> bonus
//   - "... Bundle" -> bundle
//   - everything else -> pattern
// The "Free Digital Download"/"Free" and boilerplate words are stripped from
// the display name. No reliable release date. Identity is the product slug.
// ---------------------------------------------------------------------------

const BASE = "https://www.wildflowerdesignpatterns.com"
const PRODUCT_SITEMAP = `${BASE}/store-products-sitemap.xml`
const CONCURRENCY = 2

const ADDON = /\bexpansion\b|\badd[-\s]?on\b/i
const FREE = /\bfree (?:digital )?download\b|\bfree pattern\b/i
const BUNDLE = /\bbundle\b/i

export function cleanWildflowerName(name: string): string {
  return (name ?? "")
    .replace(/\s*[-–—]?\s*free (?:digital )?download\s*$/i, "")
    .replace(/\s*\|\s*Wildflower[^|]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function wixStaticImage(html: string): string | null {
  const m = html.match(/(?:https?:)?\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_.~/-]+\.(?:jpg|jpeg|png|webp)/i)
  return m ? m[0] : null
}

function absoluteImage(src: string | null | undefined): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  if (trimmed.startsWith("static.wixstatic.com")) return `https://${trimmed}`
  return null
}

function classify(name: string): ScrapedPattern["kind"] {
  if (ADDON.test(name)) return "addon"
  if (FREE.test(name)) return "bonus"
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

function slugOf(url: string): string {
  const path = url.replace(/[#?].*$/, "").replace(/\/$/, "")
  return path.split("/").filter(Boolean).pop() ?? url
}

async function discoverProductUrls(): Promise<string[]> {
  const xml = await fetchText(PRODUCT_SITEMAP)
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  return [...new Set(urls)]
}

export const wildflowerDesignAdapter: DesignerAdapter = {
  slug: "wildflower-design",
  label: "Wildflower Design",
  matchHosts: ["wildflowerdesignpatterns.com", "www.wildflowerdesignpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const urls = await discoverProductUrls()

    const scraped = await mapWithConcurrency(urls, CONCURRENCY, async (url): Promise<ScrapedPattern | null> => {
      const extract = (html: string) => {
        const ld = jsonLdProduct(html)
        const rawName = ld?.name ?? metaContent(html, "og:title")?.replace(/\s*\|\s*Wildflower[^|]*$/i, "").trim()
        const imageUrl = absoluteImage(ld?.image ?? metaContent(html, "og:image") ?? wixStaticImage(html))
        return { rawName, imageUrl }
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

      return {
        name: cleanWildflowerName(data.rawName),
        url,
        imageUrl: data.imageUrl ?? null,
        releaseDate: null,
        kind: classify(data.rawName),
        sourceId: slugOf(url),
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
