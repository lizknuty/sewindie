import type { ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Shared oliverands.com (Miva) store scraper
// ---------------------------------------------------------------------------
// oliverands.com is a single bespoke Miva store shared by several sibling
// brands -- Oliver + S, Liesl + Co, and Lisette -- each of which is a distinct
// SewIndie designer. There is no Shopify/JSON catalogue API, but every product
// page carries a GA4 ecommerce dataLayer with machine-set `item_id` (SKU) and
// `item_brand` fields. The only complete, stable way to list one brand's
// catalogue is to crawl the sitemap and filter product pages by `item_brand`:
// the on-site brand category listings (/shop/<brand>-patterns*.html) silently
// cap at 40 items with no working pagination, so they miss much of the range.
//
// This module owns all the shared machinery so each brand adapter is a thin
// wrapper around `fetchOliverandsBrandCatalogue(brandPattern)`.
//
// IMAGE SELECTION IS SKU-SCOPED (important): a product page also embeds a
// "related products" carousel showing OTHER products' _Garment images. Picking
// "the first _Garment on the page" therefore grabs a *different* product's
// photo. We extract the page's own `item_id` (SKU) and only accept images under
// /images/product/<SKU>/, which eliminates the cross-contamination.
// ---------------------------------------------------------------------------

export const STORE = "https://oliverands.com"
const SITEMAP_URL = `${STORE}/sitemap.xml`

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

// Concurrency 16 crawls the ~475 product pages in ~40s, comfortably inside the
// route's 60s budget, and drew only 200s from the store (no rate-limiting).
const CONCURRENCY = 16
const REQUEST_TIMEOUT_MS = 12_000
const MAX_RETRIES = 3

// Only product pages, never the brand/category listing pages (those are
// "...-patterns.html"). Verified: every product ends "-sewing-pattern(s)".
const PRODUCT_PATH = /\/shop\/[^/]+-sewing-patterns?\.html$/i

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      // Back off and retry on rate-limiting / transient 5xx so a blip doesn't
      // drop a real product.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`${res.status} for ${url}`)
        await sleep(400 * (attempt + 1))
        continue
      }
      if (!res.ok) return ""
      return await res.text()
    } catch (error) {
      lastError = error
      await sleep(300 * (attempt + 1))
    }
  }
  void lastError
  return ""
}

/** Runs `fn` over `items` with a fixed worker pool, preserving input order. */
export async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Last path segment, minus ".html", lower-cased. Stable per-product identity. */
export function oliverandsSlug(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const path = new URL(withScheme).pathname.replace(/\/+$/, "")
    const segment = path.split("/").filter(Boolean).pop()
    return segment ? segment.replace(/\.html$/i, "").toLowerCase() : null
  } catch {
    return null
  }
}

export function extractBrand(html: string): string | null {
  const match = html.match(/item_brand:\s*['"]([^'"]+)['"]/)
  return match ? match[1] : null
}

/** The product's own SKU from the GA4 dataLayer (`item_id`). */
export function extractSku(html: string): string | null {
  const match = html.match(/item_id:\s*['"]([^'"]+)['"]/)
  return match ? match[1] : null
}

/** Product name from the page <title>, with the store's suffix removed. */
export function extractName(html: string): string {
  const raw = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim()
  return raw
    .replace(/\s*\|\s*Shop\s*\|\s*Oliver\s*\+\s*S\s*$/i, "")
    .replace(/\s*\|\s*Oliver\s*\+\s*S\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Primary product image, SCOPED TO THE PAGE'S OWN SKU so a related-products
 * carousel can't leak another product's photo (see module header). Prefers the
 * "_Garment" shot (the DB's existing convention), then "_Dressed", then the
 * first numbered gallery image, then any remaining non-thumbnail. Protocol-
 * relative URLs are made absolute.
 */
export function extractImage(html: string): string | null {
  const sku = extractSku(html)
  if (!sku) return null
  const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(
    `(?:src|href)="((?:https?:)?\\/\\/o\\.osimg\\.net\\/images\\/product\\/${escaped}\\/[^"]+\\.(?:jpe?g|png))"`,
    "gi",
  )
  const urls = [...html.matchAll(pattern)].map((m) => m[1]).filter((s) => !/_thumb|_icon/i.test(s))
  const pick =
    urls.find((s) => /_Garment\./i.test(s)) ??
    urls.find((s) => /_Dressed\./i.test(s)) ??
    urls.find((s) => /_\d+_/.test(s)) ??
    urls[0] ??
    null
  if (!pick) return null
  return pick.startsWith("//") ? `https:${pick}` : pick
}

/** Family packs bundle several patterns; everything else is a standalone pattern. */
export function classifyProduct(name: string): ProductKind {
  if (/\bfamily pack\b/i.test(name) || /\bbundles?\b/i.test(name)) return "bundle"
  return "pattern"
}

/**
 * Crawls the shared store and returns every product whose GA4 `item_brand`
 * matches `brandPattern`, as SewIndie ScrapedPatterns. `brandLabel` is only used
 * in error messages. Reconciliation identity is the URL slug (paper and digital
 * versions are distinct products under distinct slugs and are NOT collapsed).
 * Release date is null -- the Miva pages expose no trustworthy publish date.
 */
export async function fetchOliverandsBrandCatalogue(brandPattern: RegExp, brandLabel: string): Promise<ScrapedPattern[]> {
  const sitemap = await fetchText(SITEMAP_URL)
  if (!sitemap) {
    throw new Error("Could not fetch oliverands.com sitemap")
  }

  const productUrls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))].filter((u) =>
    PRODUCT_PATH.test(u),
  )
  if (productUrls.length === 0) {
    throw new Error("No product URLs found in oliverands.com sitemap -- layout may have changed")
  }

  const pages = await poolMap(productUrls, CONCURRENCY, async (url) => ({ url, html: await fetchText(url) }))

  const results: ScrapedPattern[] = []
  for (const { url, html } of pages) {
    if (!html) continue // fetch failed after retries; skip rather than crash
    if (!brandPattern.test((extractBrand(html) ?? "").trim())) continue

    const name = extractName(html)
    const slug = oliverandsSlug(url)
    if (!name || !slug) continue

    results.push({
      name,
      url: `${STORE}/shop/${slug}.html`,
      imageUrl: extractImage(html),
      releaseDate: null,
      kind: classifyProduct(name),
      sourceId: slug,
    })
  }

  // A brand catalogue that suddenly reads empty means the brand marker or page
  // layout changed upstream, not that the brand stopped selling patterns.
  // Failing loudly beats reporting every existing pattern as vanished.
  if (results.length === 0) {
    throw new Error(`Fetched oliverands.com but matched no ${brandLabel} products -- brand marker may have changed`)
  }

  return results
}
