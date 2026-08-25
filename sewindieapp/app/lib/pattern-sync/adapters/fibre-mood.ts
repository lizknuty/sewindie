import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"

// Fibre Mood migrated from PrestaShop (shop.fibremood.com, now dead) to Shopify
// at www.fibremood.com, and the two platforms model a pattern differently.
//
// The old store sold each format as its own product, so the catalogue holds two
// rows per design -- "Zita Dress Paper Pattern" and "Zita Dress Digital
// Pattern". Shopify instead sells ONE product with Paper/Digital variants. To
// keep the catalogue's existing shape, this adapter fans a product back out into
// one row per format, using `?variant=<id>` so the two rows have distinct URLs
// that both resolve to the right option on the product page.
//
// Release dates are deliberately dropped: 82% of the catalogue shares a single
// published_at (the migration date), so importing it would stamp most of the
// catalogue with a fake release date. Every existing Fibre Mood row already has
// a null release date, so this matches the data that is already there.

const STORE_ORIGIN = "https://www.fibremood.com"

// The store files everything sewing-pattern-shaped under this one product type.
const PATTERN_PRODUCT_TYPE = "pattern"

// Shopify caps products.json at 250 per page; the catalogue is a few pages.
const PAGE_SIZE = 250
const MAX_PAGES = 12
const REQUEST_TIMEOUT_MS = 20_000

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

type ShopifyVariant = {
  id?: number
  title?: string
}

type ShopifyProduct = {
  id?: number
  title?: string
  handle?: string
  product_type?: string
  images?: { src?: string }[]
  variants?: ShopifyVariant[]
}

/** The two formats the catalogue tracks as separate rows. */
const FORMAT_VARIANTS = new Set(["digital", "paper"])

/**
 * Products filed under "Pattern" that are not a single sewing pattern. These are
 * flagged rather than dropped so an admin can still see and choose them.
 */
function classify(title: string): ProductKind {
  // "Rio Jumper Knitting Pattern", "Wall Hanging Macrame Pattern" -- a different
  // craft entirely, and none of these exist in the catalogue today.
  if (/\b(knitting|macram(?:e|\u00e9))\b/i.test(title)) return "other"
  // "Look of the Season Sewing Pattern" is a seasonal collection, not a pattern.
  if (/\blook of the season\b/i.test(title)) return "other"
  // "Pattern Bundle: City Trip"
  if (/\bpattern bundle\b/i.test(title)) return "bundle"
  // "Lydia Blouse Sewing Pattern (L-Family containing 5 patterns)"
  if (/\(\s*[a-z]{1,2}-family\b[^)]*\)/i.test(title)) return "bundle"
  return "pattern"
}

/**
 * Strips the store's "Sewing Pattern" boilerplate to get the design name, so the
 * format suffix the catalogue uses can be appended. Note the store has at least
 * one title with a double space ("Cory T-shirt Sewing  Pattern"), hence the
 * flexible whitespace and the final collapse.
 */
function baseName(title: string): string {
  const stripped = title
    .replace(/\s*\bsewing\s+patterns?\b\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  // If a title were nothing but boilerplate, keep the original rather than
  // producing an empty name.
  return stripped || title.replace(/\s+/g, " ").trim()
}

function productUrl(handle: string, variantId?: number): string {
  const base = `${STORE_ORIGIN}/products/${handle}`
  return variantId ? `${base}?variant=${variantId}` : base
}

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${STORE_ORIGIN}/products.json?limit=${PAGE_SIZE}&page=${page}`
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Fibre Mood store returned ${response.status} for page ${page}`)
  }
  const body = (await response.json()) as { products?: ShopifyProduct[] }
  return Array.isArray(body.products) ? body.products : []
}

async function fetchCatalogue(): Promise<ScrapedPattern[]> {
  const products: ShopifyProduct[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchPage(page)
    if (batch.length === 0) break
    products.push(...batch)
    if (batch.length < PAGE_SIZE) break
    // Small pause between pages to stay polite to the store.
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const rows: ScrapedPattern[] = []

  for (const product of products) {
    const title = typeof product.title === "string" ? product.title.replace(/\s+/g, " ").trim() : ""
    const handle = typeof product.handle === "string" ? product.handle.trim() : ""
    if (!title || !handle) continue
    if ((product.product_type ?? "").trim().toLowerCase() !== PATTERN_PRODUCT_TYPE) continue

    const imageUrl = product.images?.find((image) => image?.src)?.src ?? null
    const kind = classify(title)
    const sourceId = String(product.id ?? handle)

    // Anything that isn't a single sewing pattern stays as one row under the
    // store's own title -- splitting a bundle or a knitting pattern into
    // "Paper"/"Digital" rows would invent a distinction the store doesn't make.
    if (kind !== "pattern") {
      rows.push({ name: title, url: productUrl(handle), imageUrl, releaseDate: null, kind, sourceId })
      continue
    }

    const base = baseName(title)
    const formats = (product.variants ?? []).filter((variant) =>
      FORMAT_VARIANTS.has((variant.title ?? "").trim().toLowerCase()),
    )

    // A pattern with no recognisable format variant still belongs in the report;
    // fall back to a single row so it can't silently vanish.
    if (formats.length === 0) {
      rows.push({ name: title, url: productUrl(handle), imageUrl, releaseDate: null, kind, sourceId })
      continue
    }

    for (const variant of formats) {
      const format = (variant.title ?? "").trim().toLowerCase() === "digital" ? "Digital" : "Paper"
      rows.push({
        name: `${base} ${format} Pattern`,
        url: productUrl(handle, variant.id),
        imageUrl,
        releaseDate: null,
        kind,
        sourceId: `${sourceId}-${variant.id ?? format}`,
      })
    }
  }

  return rows
}

export const fibreMoodAdapter: DesignerAdapter = {
  slug: "fibre-mood",
  label: "Fibre Mood",
  // The catalogue's designer record still points at the retired PrestaShop
  // store, and every existing pattern URL is on that dead host, so both the old
  // and new hosts have to be recognised for this designer.
  matchHosts: ["fibremood.com", "www.fibremood.com", "shop.fibremood.com"],
  fetchCatalogue,
}
