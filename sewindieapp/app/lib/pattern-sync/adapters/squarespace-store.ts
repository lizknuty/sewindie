import type { ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Shared Squarespace store crawler
// ---------------------------------------------------------------------------
// Squarespace exposes any collection page as JSON by appending `?format=json`
// to its URL, returning `{ items: [...], pagination: { nextPage,
// nextPageOffset } }`. Store products are `recordType` 11 and carry title,
// fullUrl ("/<store>/p/<slug>"), assetUrl (primary CDN image) and publishOn
// (release timestamp in epoch MILLISECONDS).
//
// This module centralises the fetch + offset pagination + dedup that three
// Squarespace adapters (Greyfriars & Grace, Homer + Howells, and -- historically
// -- Goldfinch) all need. Each adapter supplies only its store origin, its
// collection path, and how to turn a raw item into a name/kind. Goldfinch keeps
// its own inlined copy so a verified adapter is not disturbed.
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const MAX_PAGES = 20 // hard stop against a pagination bug
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

export type SquarespaceItem = {
  id?: string
  recordType?: number
  title?: string
  fullUrl?: string
  assetUrl?: string
  publishOn?: number
  // A store item's image can also live in a nested variant/gallery.
  items?: Array<{ assetUrl?: string }>
}

type SquarespacePage = {
  items?: SquarespaceItem[]
  pagination?: { nextPage?: boolean; nextPageOffset?: number }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// epoch-ms -> ISO date string (null when absent). Exported for unit tests.
export function publishOnToIso(publishOn: number | undefined | null): string | null {
  if (typeof publishOn !== "number" || !Number.isFinite(publishOn)) return null
  const d = new Date(publishOn)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function firstImage(item: SquarespaceItem): string | null {
  return item.assetUrl?.trim() || item.items?.find((i) => i?.assetUrl)?.assetUrl?.trim() || null
}

async function fetchCollectionPage(store: string, path: string, offset?: number): Promise<SquarespacePage> {
  const url = `${store}${path}?format=json${offset ? `&offset=${offset}` : ""}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Squarespace returned ${res.status} for ${url}`)
  return (await res.json()) as SquarespacePage
}

export type SquarespaceMapping = {
  // Clean the raw item title into the display name.
  cleanName: (rawTitle: string) => string
  // Decide the product kind from the cleaned name.
  classify: (name: string) => ProductKind
}

// Turn one raw Squarespace store item into a ScrapedPattern (null when
// unusable). Exported so verify scripts can unit-test mappings offline.
export function itemToPattern(store: string, item: SquarespaceItem, mapping: SquarespaceMapping): ScrapedPattern | null {
  if (item.recordType !== undefined && item.recordType !== 11) return null
  const name = mapping.cleanName((item.title ?? "").replace(/\s+/g, " ").trim())
  const path = (item.fullUrl ?? "").trim()
  if (!name || !path) return null

  return {
    name,
    url: path.startsWith("http") ? path : `${store}${path}`,
    imageUrl: firstImage(item),
    releaseDate: publishOnToIso(item.publishOn),
    kind: mapping.classify(name),
    sourceId: String(item.id ?? path),
  }
}

// Crawl an entire Squarespace collection, following offset pagination.
export async function crawlSquarespaceStore(
  store: string,
  collectionPath: string,
  mapping: SquarespaceMapping,
): Promise<ScrapedPattern[]> {
  const items: SquarespaceItem[] = []
  let offset: number | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchCollectionPage(store, collectionPath, offset)
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
    const pattern = itemToPattern(store, item, mapping)
    if (!pattern) continue
    if (seen.has(pattern.url)) continue // guard against pagination overlap
    seen.add(pattern.url)
    results.push(pattern)
  }
  return results
}
