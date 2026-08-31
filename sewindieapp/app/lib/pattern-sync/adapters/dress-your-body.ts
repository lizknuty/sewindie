import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Dress Your Body (dressyourbody.fr) -- WooCommerce Store API, French.
//
// Patterns are named "Patron <Design>" (incl. "patron gratuit" = free pattern,
// kept). The store also carries non-patterns we exclude by NAME: gift card
// ("Carte cadeau"), lookbooks, labels/licences ("Etiquettes/Licences"), and
// heat-transfer vinyl ("Flex ..."). "Pack ..." names are bundles. We strip the
// leading "Patron" prefix from names. Store API omits date_created.
// ---------------------------------------------------------------------------

const BASE = "https://dressyourbody.fr"

const EXCLUDE =
  /carte cadeau|bon cadeau|gift|lookbook|etiquettes?|licences?|\bflex\b|\bflock\b|\bvinyle?\b|\btissu\b/i
const BUNDLE = /\b(?:pack|lot|bundle|duo)\b/i

function firstImage(product: WooProduct): string | null {
  return product.images?.find((i) => i?.src)?.src ?? null
}

// Drop the leading "Patron " prefix; keep the rest of the design name.
export function cleanDressYourBodyName(raw: string): string {
  const decoded = decodeEntities((raw ?? "").replace(/\s+/g, " ").trim())
  const stripped = decoded.replace(/^patron\s+(?:de\s+couture\s+)?/i, "").trim()
  return stripped || decoded
}

function classify(name: string): ProductKind {
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const dressYourBodyAdapter: DesignerAdapter = {
  slug: "dress-your-body",
  label: "Dress Your Body",
  matchHosts: ["dressyourbody.fr", "www.dressyourbody.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      const rawName = decodeEntities((product.name ?? "").replace(/\s+/g, " ").trim())
      if (!rawName) continue
      if (EXCLUDE.test(rawName)) continue

      const name = cleanDressYourBodyName(product.name ?? "")
      if (!name) continue

      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: firstImage(product),
        releaseDate: product.date_created ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
