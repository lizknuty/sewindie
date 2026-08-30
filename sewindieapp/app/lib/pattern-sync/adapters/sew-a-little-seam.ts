import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchText, metaContent, jsonLdProduct, mapWithConcurrency, decodeEntities } from "./scrape-helpers"

// ---------------------------------------------------------------------------
// Sew a Little Seam (sewalittleseam.com) -- WooCommerce, but crawled via the
// product sitemap rather than the Store API.
//
// WHY NOT the shared Woo Store API helper: this store has an unusually heavy
// per-product payload (~70KB each) AND one pathological product whose PAGINATED
// listing hangs server-side at every page size (verified: page covering items
// ~41-60 times out at per_page=100/25/20/10 alike, while every other page
// returns in ~1s). So the listing endpoint can't be crawled reliably. However
// the product SITEMAP (/product-sitemap.xml) and each individual product PAGE
// respond fast and stably, so we crawl those instead -- the same
// discover-then-fetch shape used by the Wix/PrestaShop adapters.
//
// Each product page exposes a clean JSON-LD Product node (name + image), with
// og:title/og:image as fallbacks. The catalogue is entirely PDF sewing patterns
// (children's + women's), so classification is by name only: multi-pattern
// bundles ("... Bundle", "Set of ...", "... and ... Bundle Set") -> bundle,
// everything else -> pattern. Size/age descriptors are stripped from the
// display name. No reliable release date. Identity is the product slug.
// ---------------------------------------------------------------------------

const BASE = "https://www.sewalittleseam.com"
const PRODUCT_SITEMAP = `${BASE}/product-sitemap.xml`
const CONCURRENCY = 4

const BUNDLE = /\bbundle\b|\bbundle set\b|\bset of\b/i
const GIFT_CARD = /gift\s*card|gift\s*voucher/i

// Strip trailing size/age-range descriptors and the "PDF (Sewing) Pattern"
// boilerplate so listings read as the design name:
//   "Hadley Top, Tunic & Dress PDF Pattern 12 Months-12 Years" -> "Hadley Top, Tunic & Dress"
//   "Birthday Dress & Peplum Pattern (Size 2)"                 -> "Birthday Dress & Peplum"
//   "Princess Dress (Size 3)"                                  -> "Princess Dress"
//   "Childrens Nightingale Plus Size PDF Pattern"              -> "Childrens Nightingale"
// NB the bare word "Pattern" is only stripped when it's the boilerplate tail
// before a size/format marker -- designs like "Once Upon a Pattern" and
// "Avery Apron Pattern" keep their "Pattern" because nothing follows it.
export function cleanSlsName(rawTitle: string): string {
  const original = decodeEntities(rawTitle ?? "").replace(/\s*-\s*Sew a Little Seam\s*$/i, "")
  // Did the raw title carry a size/age descriptor? Only then is a trailing bare
  // "Pattern" boilerplate (so "Once Upon a Pattern" / "Avery Apron Pattern" are
  // left untouched, but "Birthday Dress & Peplum Pattern (Size 2)" is cleaned).
  const hadSize = /\(?(?:plus\s+)?sizes?\b|\d+\s*(?:mo|month|months|yr|year|years)\b/i.test(original)
  let name = original
    // parenthesized size: "(Size 2)", "(Sizes 2-12)"
    .replace(/\s*\((?:plus\s+)?sizes?\b[^)]*\)\s*/gi, " ")
    // age/size range tails: "12 Months-12 Years", "3mo-12yr and Plus Sizes 4-12"
    .replace(/\s+\d+\s*(?:mo|month|months|yr|year|years)\b.*$/i, "")
    .replace(/\s+(?:plus\s+)?sizes?\b.*$/i, "")
    .replace(/\s+\d+\s*(?:mo|month|months|yr|year|years)\b.*$/i, "")
    // format boilerplate: "PDF Pattern", "PDF Sewing Pattern"
    .replace(/\s*\bpdf\b\s*(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\s*\bplus\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  // Trailing bare "Pattern" is boilerplate only when a size was present.
  if (hadSize) name = name.replace(/\s+\bpattern\b\s*$/i, "").trim()
  return name || original.trim()
}

// Product slug from a Woo product-page URL (/product/<slug>/) as stable id.
function slugOf(url: string): string {
  const path = url.replace(/[#?].*$/, "").replace(/\/$/, "")
  return path.split("/").filter(Boolean).pop() ?? url
}

async function discoverProductUrls(): Promise<string[]> {
  const xml = await fetchText(PRODUCT_SITEMAP)
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    // sitemap includes the /shop/ landing page alongside /product/<slug>/ pages
    .filter((u) => /\/product\//.test(u))
  return [...new Set(urls)]
}

export const sewALittleSeamAdapter: DesignerAdapter = {
  slug: "sew-a-little-seam",
  label: "Sew a Little Seam",
  matchHosts: ["sewalittleseam.com", "www.sewalittleseam.com"],

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
      const rawName = ld?.name ?? metaContent(html, "og:title")?.replace(/\s*-\s*Sew a Little Seam\s*$/i, "").trim()
      if (!rawName) return null
      // The store gift card / voucher lives under /product/ too; it isn't a pattern.
      if (GIFT_CARD.test(rawName) || /\/product\/gift-card\/?$/i.test(url)) return null

      return {
        name: cleanSlsName(rawName),
        url,
        imageUrl: ld?.image ?? metaContent(html, "og:image") ?? null,
        releaseDate: null,
        kind: BUNDLE.test(rawName) ? "bundle" : "pattern",
        sourceId: slugOf(url),
      }
    })

    return scraped.filter((p): p is ScrapedPattern => p !== null)
  },
}
