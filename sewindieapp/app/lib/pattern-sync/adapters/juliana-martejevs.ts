import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { fetchWooProducts, decodeEntities, type WooProduct } from "./woo-store"

// ---------------------------------------------------------------------------
// Juliana Martejevs (julianamartejevs.com) -- WooCommerce, GERMAN.
//
// (This store returned HTTP 500 on earlier probes but has since recovered.)
//
// ~167 products spanning sewing patterns ("Schnittmuster") plus non-sewing
// craft: DIY kits ("DIY-Sets"), macrame ("Makramee"), knitting ("Stricken"),
// embroidery ("Sticken") and accessories. We keep ONLY products in the
// "Schnittmuster" (sewing pattern) category and drop the rest.
//
// "Bundles" category / name -> bundle. German pattern names are kept verbatim
// (minus a trailing "Schnittmuster" / "- Nähanleitung" descriptor).
// ---------------------------------------------------------------------------

const BASE = "https://julianamartejevs.com"

const PATTERN_CATEGORY = /schnittmuster/i
const BUNDLE_CATEGORY = /bundle/i

export function cleanJulianaName(rawName: string): string {
  return decodeEntities(rawName)
    .replace(/\s*[-–—|]\s*(schnittmuster|n[äa]hanleitung|pdf|ebook|e-book).*$/i, "")
    // "Latzkleid Schnittmuster KYLIE" -> drop the inline "Schnittmuster" label.
    .replace(/\bschnittmuster\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isSchnittmuster(product: WooProduct): boolean {
  return (product.categories ?? []).some((c) => PATTERN_CATEGORY.test(c?.name ?? ""))
}

function classify(product: WooProduct, name: string): ProductKind {
  const cats = (product.categories ?? []).map((c) => c?.name ?? "")
  if (cats.some((c) => BUNDLE_CATEGORY.test(c)) || /\bbundle\b/i.test(name)) return "bundle"
  return "pattern"
}

export const julianaMartejevsAdapter: DesignerAdapter = {
  slug: "juliana-martejevs",
  label: "Juliana Martejevs",
  matchHosts: ["julianamartejevs.com", "www.julianamartejevs.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const products = await fetchWooProducts(BASE)
    const results: ScrapedPattern[] = []

    for (const product of products) {
      if (!isSchnittmuster(product)) continue
      const name = cleanJulianaName(product.name ?? "")
      if (!name) continue
      results.push({
        name,
        url: product.permalink ?? BASE,
        imageUrl: product.images?.find((i) => i?.src)?.src ?? null,
        releaseDate: product.date_created ?? null,
        kind: classify(product, name),
        sourceId: String(product.id),
      })
    }

    return results
  },
}
