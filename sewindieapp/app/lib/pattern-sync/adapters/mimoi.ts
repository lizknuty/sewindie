import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchShopifyProducts, shopifyProductUrl, type ShopifyProduct } from "./shopify-feed"

// ---------------------------------------------------------------------------
// Mimoï (mimoi.fr) -- Shopify, French.
//
// ~78 listings. Each design is sold as a digital "Patron PDF" and (for some) a
// paper-envelope "Patron pochette" -- format twins of the SAME design. We
// collapse them by cleaned design name, preferring the PDF listing as canonical.
//
// Title shape: "<Name>, <garment(s)> - Patron pochette/PDF". This designer
// names every pattern "<Name>, <garment>" (e.g. "Aventine, robe"), but the
// catalogue convention stores just the design name ("Aventine") with the
// garment moved into a category field. So we drop the garment words from the
// comma-tail. Identity qualifiers that are NOT garments -- "multiversions",
// "pack ...", "complément ..." -- are kept, otherwise two distinct records like
// "Léonie, pack hiver" and "Léonie, blouse multiversions" would both collapse
// to "Léonie" and one would be dropped from the feed.
//
// URL matching is dead for this store: the DB holds pre-migration WooCommerce
// links (/produit/<slug>) while the live site is Shopify (/products/<handle>),
// so the name is the only usable key -- hence the care taken to clean it well.
// "Pack"/"Lot" -> bundle.
// ---------------------------------------------------------------------------

const STORE = "https://mimoi.fr"

const KEEP_TYPE = /patron/i // "Patron PDF" or "Patron pochette"

// Garment names, articles/connectors, and cut modifiers that make up a garment
// descriptor. Anything in the comma-tail that is NOT one of these is treated as
// part of the pattern's identity and kept. Compared accent- and case-folded.
const GARMENT_TAIL_WORDS = new Set([
  // garments
  "robe", "robes", "blouse", "blouses", "pull", "pulls", "jupe", "jupes",
  "pantalon", "pantalons", "short", "shorts", "tee", "shirt", "teeshirt", "tshirt",
  "chemise", "chemises", "chemisier", "chemisiers", "surchemise", "surchemises",
  "veste", "vestes", "sweat", "sweats", "sweatshirt", "top", "tops",
  "combinaison", "combinaisons", "combi", "blazer", "blazers", "gilet", "gilets",
  "manteau", "manteaux", "cardigan", "cardigans", "debardeur", "debardeurs",
  "bralette", "bomber", "salopette", "mariniere", "cape", "caraco", "culotte",
  "nuisette", "kimono", "poncho", "doudoune", "parka", "trench",
  // articles / connectors
  "le", "la", "les", "l", "un", "une", "de", "du", "des", "d", "et", "ou", "a",
  // cut / length modifiers
  "midi", "maxi", "mini", "longue", "longues", "long", "longs", "court", "courte",
  "courtes", "courts", "doublee", "doublees", "nouee", "nouees", "noue", "bretelles",
  "sans", "manche", "manches",
])

function fold(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function cleanMimoiName(rawTitle: string): string {
  const decoded = (rawTitle ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—]\s*patron\s*(pochette|pdf)\b.*$/i, "") // drop format tail
    .replace(/\s+/g, " ")
    .trim()

  const commaIdx = decoded.indexOf(",")
  if (commaIdx === -1) return decoded

  const head = decoded.slice(0, commaIdx).trim()
  const tail = decoded.slice(commaIdx + 1).trim()

  // Keep only the tail tokens that aren't garment/connector/modifier words.
  const kept = tail.split(/[\s,]+/).filter((token) => {
    const folded = fold(token)
    return folded.length > 0 && !GARMENT_TAIL_WORDS.has(folded)
  })

  return kept.length ? `${head}, ${kept.join(" ")}` : head
}

function classify(name: string): ProductKind {
  if (/\b(pack|lot|bundle)\b/i.test(name)) return "bundle"
  return "pattern"
}

export const mimoiAdapter: DesignerAdapter = {
  slug: "mimoi",
  label: "Mimoï",
  matchHosts: ["mimoi.fr", "www.mimoi.fr"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = (await fetchShopifyProducts(STORE)) as ShopifyProduct[]
    // PDF listings first so they win as the canonical entry on collapse.
    const ordered = products
      .filter((p) => KEEP_TYPE.test(p.product_type ?? ""))
      .sort((a, b) => (/pdf/i.test(a.product_type ?? "") ? 0 : 1) - (/pdf/i.test(b.product_type ?? "") ? 0 : 1))

    const byName = new Map<string, ScrapedPattern>()
    for (const product of ordered) {
      const name = cleanMimoiName(product.title)
      if (!name) continue
      const key = name.toLowerCase()
      if (byName.has(key)) continue // format twin already captured (PDF preferred)
      byName.set(key, {
        name,
        url: shopifyProductUrl(STORE, product.handle),
        imageUrl: product.images?.[0]?.src ?? null,
        releaseDate: product.published_at ?? null,
        kind: classify(name),
        sourceId: String(product.id),
      })
    }

    return [...byName.values()]
  },
}
