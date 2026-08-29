import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Goldfinch Textile Studio
// ---------------------------------------------------------------------------
// A zero/minimal-waste indie label on SQUARESPACE -- the first Squarespace
// store wired into pattern-sync. Fresh backfill (0 existing rows).
//
// Squarespace exposes any collection page as JSON by appending
// `?format=json` to its URL. The store lives at /shop, so
// `/shop?format=json` returns `{ items: [...], pagination: {...} }`. Each store
// item ("recordType" 11) carries everything needed:
//   - title      -> the product name (kept verbatim; the brand bakes the
//                   format into the title in varied ways -- "... Digital Sewing
//                   Pattern", "... A Zero-Waste PDF Sewing Pattern" -- so there
//                   is no clean suffix to strip like the Shopify stores have)
//   - fullUrl    -> site-relative product URL ("/shop/p/<slug>")
//   - assetUrl   -> the primary product image on the Squarespace CDN
//   - publishOn  -> release timestamp in epoch MILLISECONDS (kept as the date;
//                   these are spread across real dates, not a migration batch)
//   - id         -> stable Squarespace item id, used as sourceId
//
// The whole catalogue is 8 sewing patterns today (confirmed against the store
// sitemap's 8 /shop/p/ URLs). Pagination is followed defensively via
// `pagination.nextPageOffset` so the adapter still captures everything if the
// shop grows past one page. A gift card, if ever added, is flagged "other".
// ---------------------------------------------------------------------------

const STORE = "https://www.goldfinch.design"
const SHOP_PATH = "/shop"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const MAX_PAGES = 20 // hard stop against a pagination bug (8 items today)
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

const BUNDLE_TITLE = /\bbundles?\b/i
const NON_PATTERN_TITLE = /\bgift\s*cards?\b/i

export type SquarespaceItem = {
  id?: string
  recordType?: number
  title?: string
  fullUrl?: string
  assetUrl?: string
  publishOn?: number
}

type SquarespacePage = {
  items?: SquarespaceItem[]
  pagination?: { nextPage?: boolean; nextPageOffset?: number }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function classify(name: string): ProductKind {
  if (NON_PATTERN_TITLE.test(name)) return "other"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

// epoch-ms -> ISO date string (null when absent). Exported for unit tests.
export function publishOnToIso(publishOn: number | undefined | null): string | null {
  if (typeof publishOn !== "number" || !Number.isFinite(publishOn)) return null
  const d = new Date(publishOn)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Map one Squarespace store item to a ScrapedPattern (null when unusable).
// Exported for the verify script's offline unit tests.
export function itemToPattern(item: SquarespaceItem): ScrapedPattern | null {
  const name = (item.title ?? "").replace(/\s+/g, " ").trim()
  const path = (item.fullUrl ?? "").trim()
  if (!name || !path) return null

  return {
    name,
    url: path.startsWith("http") ? path : `${STORE}${path}`,
    imageUrl: item.assetUrl?.trim() || null,
    releaseDate: publishOnToIso(item.publishOn),
    kind: classify(name),
    sourceId: String(item.id ?? path),
  }
}

async function fetchShopPage(offset?: number): Promise<SquarespacePage> {
  const url = `${STORE}${SHOP_PATH}?format=json${offset ? `&offset=${offset}` : ""}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Goldfinch returned ${res.status} for ${url}`)
  return (await res.json()) as SquarespacePage
}

export const goldfinchTextileStudioAdapter: DesignerAdapter = {
  slug: "goldfinch-textile-studio",
  label: "Goldfinch Textile Studio",
  matchHosts: ["goldfinch.design", "www.goldfinch.design"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const items: SquarespaceItem[] = []
    let offset: number | undefined

    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await fetchShopPage(offset)
      const batch = data.items ?? []
      if (batch.length === 0) break
      items.push(...batch)

      if (!data.pagination?.nextPage || !data.pagination.nextPageOffset) break
      offset = data.pagination.nextPageOffset
      await sleep(PAGE_DELAY_MS)
    }

    const results: ScrapedPattern[] = []
    const seen = new Set<string>()
    for (const item of items) {
      const pattern = itemToPattern(item)
      if (!pattern) continue
      if (seen.has(pattern.url)) continue // guard against pagination overlap
      seen.add(pattern.url)
      results.push(pattern)
    }
    return results
  },
}
