import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Melilot (melilot.no) -- Shopify, Norwegian.
//
// ~74 products. product_type "Symønster" (= sewing pattern) is what we keep.
// Exclude "Stoffer" (fabric), "Book", "Digitalt kurs" (digital course),
// "Julekalender" (advent calendar). Names are short design names ("Akira",
// "Polly"); no PDF/format suffix to strip. "Pakke"/"Bundle" -> bundle.
// ---------------------------------------------------------------------------

const STORE = "https://melilot.no"

const KEEP_TYPE = /^sym.nster$/i // Symønster (ø may arrive as-is)

export function cleanMelilotName(rawTitle: string): string {
  return (rawTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function classify(name: string): ProductKind {
  const n = name.toLowerCase()
  if (/\bpakke\b|\bbundle\b/.test(n)) return "bundle"
  if (/\butvidelse\b|\bexpansion\b/.test(n)) return "addon"
  return "pattern"
}

export const melilotAdapter: DesignerAdapter = {
  slug: "melilot",
  label: "Melilot",
  matchHosts: ["melilot.no", "www.melilot.no"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchShopifyProducts(STORE)
    const results: ScrapedPattern[] = []

    for (const product of products as ShopifyProduct[]) {
      if (!KEEP_TYPE.test(product.product_type ?? "")) continue // skip fabric/book/course/advent
      const name = cleanMelilotName(product.title)
      if (!name) continue
      results.push({
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
