import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// ---------------------------------------------------------------------------
// Friday Pattern Company
// ---------------------------------------------------------------------------
// US indie pattern house on Shopify. Fresh backfill (0 existing rows). Every
// product carries a real product_type, which drives all classification:
//
//   PDF Patterns (39) + Printed Patterns (23)  -> the pattern catalogue
//   Bundle (8)                                 -> multi-pattern packs (kind "bundle")
//   (none) (5)                                 -> bumper stickers (kind "other")
//   Gift Cards (1)                             -> kind "other"
//
//  1. FORMAT PAIRS COLLAPSE TO ONE DESIGN. Almost every design is sold twice,
//     once as a "PDF Pattern" and once as a "Printed Pattern" ("Uma Dress and
//     Top - PDF Pattern" / "... - Printed Pattern"). These are the same design
//     in two delivery formats, so they collapse to one row keyed on the title
//     with the trailing " - PDF/Printed Pattern" suffix stripped. 62 format
//     products collapse to 41 designs. The PDF listing is preferred as
//     canonical when both exist (digital is the evergreen SKU); otherwise the
//     first-seen listing wins.
//
//  2. BUNDLES AND MERCH ARE KEPT BUT FLAGGED. Bundles are real sellable
//     products but not single designs, so they are emitted with kind "bundle";
//     stickers and gift cards are emitted with kind "other". The admin review
//     UI can deselect these; they are not silently dropped.
//
//  3. RELEASE DATE KEPT. published_at values track the real release history.
// ---------------------------------------------------------------------------

const STORE = "https://fridaypatterncompany.com"
const PRODUCTS_FEED = `${STORE}/products.json`
const PRODUCTS_PATH = "/products/"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const PER_PAGE = 250
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 20_000
const PAGE_DELAY_MS = 250

// Trailing delivery-format tag, e.g. " - PDF Pattern", " – Printed Pattern".
const FORMAT_SUFFIX = /\s*[-–]\s*(pdf|printed)\s+patterns?\s*$/i

export type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  published_at?: string
  images?: Array<{ src?: string }>
}

type Classified = {
  design: string // format-stripped design name, casing preserved
  handle: string
  imageUrl: string | null
  publishedAt: string | null
  sourceId: string
  kind: ProductKind
  isPdf: boolean // PDF listing preferred as canonical within a design group
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Map a Shopify product_type to our ProductKind. Exported for unit tests.
export function kindForType(productType: string): ProductKind | null {
  const type = productType.trim().toLowerCase()
  if (type === "pdf patterns" || type === "printed patterns") return "pattern"
  if (type === "bundle") return "bundle"
  if (type === "gift cards" || type === "") return "other"
  return "other"
}

// Strip the trailing " - PDF/Printed Pattern" tag so the two format listings of
// a design share one key. Exported for the verify script's offline unit tests.
export function designStem(title: string): string {
  return title.replace(FORMAT_SUFFIX, "").trim()
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${PRODUCTS_FEED}?limit=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Friday Pattern Company returned ${res.status} for ${url}`)
  const body = (await res.json()) as { products?: unknown }
  return Array.isArray(body.products) ? (body.products as ShopifyProduct[]) : []
}

// Classify every product and decode its design stem. Exported for unit tests.
export function classifyProducts(products: ShopifyProduct[]): Classified[] {
  const out: Classified[] = []
  for (const product of products) {
    const rawType = product.product_type ?? ""
    const kind = kindForType(rawType)
    if (!kind) continue

    const rawTitle = (product.title ?? "").replace(/\s+/g, " ").trim()
    const handle = (product.handle ?? "").trim()
    if (!rawTitle || !handle) continue

    // Only real patterns get their format suffix stripped/collapsed; bundles
    // and merch keep their full title.
    const design = kind === "pattern" ? designStem(rawTitle) : rawTitle
    if (!design) continue

    out.push({
      design,
      handle,
      imageUrl: product.images?.find((image) => image?.src)?.src ?? null,
      publishedAt: product.published_at ?? null,
      sourceId: String(product.id ?? handle),
      kind,
      isPdf: /pdf/i.test(rawType),
    })
  }
  return out
}

// Collapse pattern format-pairs to one row; pass bundles/merch through as-is.
// Exported for the verify script's offline unit tests.
export function collapse(classified: Classified[]): ScrapedPattern[] {
  const patternGroups = new Map<string, Classified>()
  const passthrough: Classified[] = []

  for (const item of classified) {
    if (item.kind !== "pattern") {
      passthrough.push(item)
      continue
    }
    const key = item.design.toLowerCase()
    const existing = patternGroups.get(key)
    // Prefer the PDF listing as canonical; otherwise keep the first seen.
    if (!existing || (!existing.isPdf && item.isPdf)) patternGroups.set(key, item)
  }

  const toPattern = (c: Classified): ScrapedPattern => ({
    name: c.design,
    url: `${STORE}${PRODUCTS_PATH}${c.handle}`,
    imageUrl: c.imageUrl,
    releaseDate: c.publishedAt,
    kind: c.kind,
    sourceId: c.sourceId,
  })

  return [...patternGroups.values(), ...passthrough].map(toPattern)
}

export const fridayPatternCompanyAdapter: DesignerAdapter = {
  slug: "friday-pattern-company",
  label: "Friday Pattern Company",
  matchHosts: ["fridaypatterncompany.com", "www.fridaypatterncompany.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products: ShopifyProduct[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page)
      if (batch.length === 0) break
      products.push(...batch)
      if (batch.length < PER_PAGE) break
      await sleep(PAGE_DELAY_MS)
    }
    return collapse(classifyProducts(products))
  },
}
