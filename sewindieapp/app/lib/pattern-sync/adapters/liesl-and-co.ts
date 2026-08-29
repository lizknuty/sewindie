import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Liesl + Co
// ---------------------------------------------------------------------------
// The hardest adapter so far, because Liesl + Co does not sell from its own
// site. lieslandco.com (the designer's stored URL) is now just a Mailchimp
// marketing page -- its `/products.json` returns 204 and it has no catalogue.
// Every Liesl + Co pattern is actually sold on oliverands.com, a bespoke Miva
// store SHARED with its sister brands Oliver + S and Lisette. So this adapter:
//
//   1. Crawls oliverands.com, not lieslandco.com. `matchHosts` still lists
//      lieslandco.com so the designer record (whose URL is lieslandco.com)
//      resolves to this adapter; `importHosts` lists oliverands.com so the
//      scraped URLs pass import validation. oliverands.com is deliberately kept
//      OUT of `matchHosts`: the separate "Oliver and S" SewIndie designer owns
//      that host, and listing it here would hijack that designer's resolution.
//
//   2. Filters the shared catalogue to Liesl + Co products only. There is no
//      Shopify JSON API here, but every product page carries a GA4 ecommerce
//      dataLayer with a machine-set `item_brand` field -- "Liesl + Co.",
//      "Oliver + S", "Lisette", "Itch to Stitch", etc. That is the ONLY
//      reliable brand discriminator: the brand category listing pages
//      (/shop/liesl-and-co-patterns*.html) silently cap at 40 items with no
//      working pagination, so they miss ~a third of the catalogue. Reading
//      item_brand off every product page is the only complete, stable method.
//      Verified: 96 products resolve to "Liesl + Co." (matching the 95 existing
//      rows, plus expected drift), across both paper and digital versions.
//
//   3. Reconciles by URL SLUG, not full URL. Liesl sells most designs in both
//      paper ("bistro-dress-sewing-pattern") and DIGITAL
//      ("digital-bistro-dress-sewing-pattern") form; the existing rows store
//      each as its own row (digital- slugs included), so these are NOT collapsed
//      -- each store product is one pattern. The slug (last path segment, minus
//      ".html") is stable identity even though the product path never varies;
//      using it via `identityKey` keeps matching robust if a category prefix is
//      ever introduced.
//
//   4. RELEASE DATE IS NULL. The Miva product pages expose no trustworthy
//      publish date, so none is recorded (cf. Ottobre, Green Pepper).
//
// Data sources per product page, both verified stable across the catalogue:
//   <title>                       -> "Digital Bistro Dress Sewing Pattern | Shop | Oliver + S"
//   item_brand: 'Liesl + Co.'     -> brand filter
//   //o.osimg.net/images/product/<SKU>/<SKU>_Garment.jpg -> primary image
// ---------------------------------------------------------------------------

const STORE = "https://oliverands.com"
const SITEMAP_URL = `${STORE}/sitemap.xml`

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

// Concurrency 16 crawls the ~475 product pages in ~40s, comfortably inside the
// route's 60s budget, and drew only 200s from the store (no rate-limiting).
const CONCURRENCY = 16
const REQUEST_TIMEOUT_MS = 12_000
const MAX_RETRIES = 3

// The brand string GA4 reports for Liesl + Co products. Matched loosely so a
// trailing period or spacing change upstream doesn't silently drop the brand.
const LIESL_BRAND = /liesl\s*\+\s*co/i

// Only product pages, never the brand/category listing pages (those are
// "...-patterns.html"). Verified: every Liesl product ends "-sewing-pattern(s)".
const PRODUCT_PATH = /\/shop\/[^/]+-sewing-patterns?\.html$/i

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchText(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      // Back off and retry on rate-limiting; treat other non-200s as a failed
      // attempt so a transient 5xx doesn't drop a real product.
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
  // Exhausted retries. For a single product page this returns "" (skip it);
  // the sitemap fetch treats an empty result as fatal (see fetchCatalogue).
  void lastError
  return ""
}

/** Runs `fn` over `items` with a fixed worker pool, preserving input order. */
async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

/** Last path segment, minus ".html", lower-cased. Stable identity -- see decision 3. */
export function lieslSlug(url: string | null | undefined): string | null {
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

function extractBrand(html: string): string | null {
  const match = html.match(/item_brand:\s*['"]([^'"]+)['"]/)
  return match ? match[1] : null
}

/** Product name from the page <title>, with the store's suffix removed. */
export function extractLieslName(html: string): string {
  const raw = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim()
  return raw
    .replace(/\s*\|\s*Shop\s*\|\s*Oliver\s*\+\s*S\s*$/i, "")
    .replace(/\s*\|\s*Oliver\s*\+\s*S\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Primary product image. The store hosts several per product on o.osimg.net;
 * prefer the "_Garment" shot (the DB's existing convention), then "_Dressed",
 * then the first non-thumbnail. Protocol-relative URLs are made absolute.
 */
export function extractLieslImage(html: string): string | null {
  const urls = [...html.matchAll(/(?:src|href)="((?:https?:)?\/\/o\.osimg\.net\/images\/product\/[^"]+\.(?:jpe?g|png))"/gi)].map(
    (m) => m[1],
  )
  const usable = urls.filter((s) => !/_thumb|\/levels\/|_icon|logo/i.test(s))
  const pick =
    usable.find((s) => /_Garment\./i.test(s)) ?? usable.find((s) => /_Dressed\./i.test(s)) ?? usable[0] ?? null
  if (!pick) return null
  return pick.startsWith("//") ? `https:${pick}` : pick
}

/** Family packs bundle several patterns; everything else is a standalone pattern. */
export function classifyLiesl(name: string): ProductKind {
  if (/\bfamily pack\b/i.test(name) || /\bbundles?\b/i.test(name)) return "bundle"
  return "pattern"
}

export const lieslAndCoAdapter: DesignerAdapter = {
  slug: "liesl-and-co",
  label: "Liesl + Co",
  // Resolves the Liesl + Co designer (whose URL is lieslandco.com). oliverands.com
  // is intentionally NOT here -- see decision 1 and `importHosts` below.
  matchHosts: ["lieslandco.com", "www.lieslandco.com"],
  // The catalogue actually lives on the shared Oliver + S store.
  importHosts: ["oliverands.com", "www.oliverands.com"],

  // Paper and digital versions are distinct products under distinct slugs; the
  // slug is stable identity. See decision 3.
  identityKey(url) {
    return lieslSlug(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
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
      if (!LIESL_BRAND.test(extractBrand(html) ?? "")) continue

      const name = extractLieslName(html)
      const slug = lieslSlug(url)
      if (!name || !slug) continue

      results.push({
        name,
        url: `${STORE}/shop/${slug}.html`,
        imageUrl: extractLieslImage(html),
        releaseDate: null, // no trustworthy publish date on the Miva pages -- see decision 4
        kind: classifyLiesl(name),
        sourceId: slug,
      })
    }

    // A Liesl-branded catalogue that suddenly reads empty means the brand marker
    // or page layout changed upstream, not that Liesl stopped selling patterns.
    // Failing loudly beats reporting every existing pattern as vanished.
    if (results.length === 0) {
      throw new Error("Fetched oliverands.com but matched no Liesl + Co products -- brand marker may have changed")
    }

    return results
  },
}
