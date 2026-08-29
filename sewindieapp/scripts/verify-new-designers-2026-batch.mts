import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

import * as jupe from "../app/lib/pattern-sync/adapters/atelier-jupe"
import * as emporia from "../app/lib/pattern-sync/adapters/emporia"
import * as es from "../app/lib/pattern-sync/adapters/experimental-space"
import * as elemeno from "../app/lib/pattern-sync/adapters/elemeno-patterns"
import * as scammit from "../app/lib/pattern-sync/adapters/atelier-scammit"

// ---------------------------------------------------------------------------
// Verifies the 2026 batch of six requested designers. Five are built (Atelier
// Jupe, Emporia, Experimental Space, Elemeno Patterns, Atelier Scammit); the
// sixth (Cali Faye Collection) is intentionally NOT built -- it sells only on
// Etsy (403-blocks server-side fetches) with no independent website, so a live
// adapter cannot work. See the pattern-sync memory note.
//
// All five are fresh backfills (~0 existing rows), so there is nothing to
// reconcile; the checks focus on registry resolution, offline unit tests of the
// parsing helpers, and a live catalogue fetch with field-integrity assertions.
// ---------------------------------------------------------------------------

let failures = 0
function ok(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`)
  if (!cond) failures++
}

function assertCommonShape(label: string, scraped: ScrapedPattern[], expectedHostRe: RegExp) {
  ok(`${label}: found products`, scraped.length > 0)
  ok(`${label}: every product has a non-empty name`, scraped.every((p) => p.name.trim().length > 0))
  ok(`${label}: no name exceeds 255 chars`, scraped.every((p) => p.name.length <= 255))
  ok(`${label}: every URL is on the expected host`, scraped.every((p) => expectedHostRe.test(p.url)))
  ok(`${label}: no duplicate source ids`, new Set(scraped.map((p) => p.sourceId)).size === scraped.length)
  ok(`${label}: no duplicate names`, new Set(scraped.map((p) => p.name.toLowerCase())).size === scraped.length)
  ok(
    `${label}: release dates (where present) are valid ISO`,
    scraped.every((p) => !p.releaseDate || !Number.isNaN(Date.parse(p.releaseDate))),
  )
}

function resolves(url: string, expectedSlug: string) {
  const adapter: DesignerAdapter | null = getAdapterForDesigner({ url })
  ok(`registry: ${url} -> ${expectedSlug}`, adapter?.slug === expectedSlug)
}

async function main() {
  console.log("=== 2026 new-designers batch verification ===\n")

  // --- registry resolution ------------------------------------------------
  console.log("--- registry resolution ---")
  resolves("https://atelierjupe.com/", "atelier-jupe")
  resolves("https://emporia-fabric.co.uk/", "emporia")
  resolves("https://experimentalspace.com/", "experimental-space")
  resolves("https://www.elemenopatterns.com/", "elemeno-patterns")
  resolves("https://www.atelier-scammit.com/", "atelier-scammit")

  // --- offline unit tests -------------------------------------------------
  console.log("\n--- Atelier Jupe: suffix filter + collapse ---")
  {
    const products: jupe.ShopifyProduct[] = [
      { id: 1, title: "Olivia Shirt Dress - PDF Pattern", handle: "olivia-pdf", published_at: "2023-01-02T00:00:00Z", images: [{ src: "a.jpg" }] },
      { id: 2, title: "Olivia Shirt Dress - Paper Pattern", handle: "olivia-paper", published_at: "2023-01-02T00:00:00Z" },
      { id: 3, title: "Sample piece - blue linen", handle: "sample-blue" },
      { id: 4, title: "The Trench Coat - PDF Pattern", handle: "trench-pdf" },
    ]
    const patterns = jupe.extractPatternProducts(products)
    ok("Jupe: keeps only the 3 pattern listings", patterns.length === 3)
    const collapsed = jupe.collapseByDesign(patterns)
    ok("Jupe: collapses Olivia paper+PDF into one design", collapsed.length === 2)
    const olivia = collapsed.find((p) => p.name === "Olivia Shirt Dress")
    ok("Jupe: PDF listing is canonical (handle)", olivia?.url.endsWith("/products/olivia-pdf") === true)
    ok("Jupe: keeps real release date", olivia?.releaseDate === "2023-01-02T00:00:00Z")
  }

  console.log("\n--- Emporia: type filter + handle collapse ---")
  {
    ok("Emporia: designKey strips brand prefix + pdf/pattern suffix", emporia.designKeyFromHandle("emporia-patterns-frida-dress-pdf-pattern") === "frida-dress")
    ok("Emporia: designKey aligns paper + pdf variants", emporia.designKeyFromHandle("emporia-frida-dress-pattern") === emporia.designKeyFromHandle("emporia-patterns-frida-dress-pdf-pattern"))
    ok("Emporia: cleanTitle drops brand prefix + trailing pattern words", emporia.cleanTitle("Emporia Patterns Frida Dress and Top PDF Pattern") === "Frida Dress and Top")
    const products: emporia.ShopifyProduct[] = [
      { id: 1, title: "Emporia Patterns Frida Dress PDF Pattern", handle: "emporia-patterns-frida-dress-pdf-pattern", product_type: "Sewing Patterns", images: [{ src: "a.jpg" }] },
      { id: 2, title: "Emporia Patterns Frida Dress Pattern", handle: "emporia-frida-dress-pattern", product_type: "Sewing Patterns" },
      { id: 3, title: "Cotton Lawn - floral", handle: "cotton-lawn", product_type: "dress" },
    ]
    const collapsed = emporia.collapseByDesign(emporia.extractPatternProducts(products))
    ok("Emporia: fabric ('dress' type) excluded, pair collapsed to 1", collapsed.length === 1)
    ok("Emporia: PDF listing canonical", collapsed[0].url.endsWith("/products/emporia-patterns-frida-dress-pdf-pattern"))
  }

  console.log("\n--- Experimental Space: sewing filter + knitting exclusion ---")
  {
    ok("ES: designName takes pre-colon part, strips *...*", es.designName("Josie Blouse : Sewing Pattern (PDF) *LIMITED SIZES*") === "Josie Blouse")
    ok("ES: detectFormat reads PDF", es.detectFormat("Josie Blouse : Sewing Pattern (PDF)") === "pdf")
    ok("ES: detectFormat defaults to paper", es.detectFormat("Josie Blouse : Paper Pattern") === "paper")
    const products: es.WooProduct[] = [
      { id: 1, name: "Josie Blouse : Sewing Pattern (PDF)", permalink: "https://experimentalspace.com/product/josie-pdf/", categories: [{ name: "PDF Patterns" }, { name: "Sewing Patterns" }], images: [{ src: "a.jpg" }] },
      { id: 2, name: "Josie Blouse : Paper Pattern", permalink: "https://experimentalspace.com/product/josie-paper/", categories: [{ name: "Paper Patterns" }] },
      { id: 3, name: "Casey Sweater : Knitting Pattern (PDF)", permalink: "https://experimentalspace.com/product/casey-knit/", categories: [{ name: "Knitting Patterns" }] },
      { id: 4, name: "Rosalee : A0 Copyshop Print", permalink: "https://experimentalspace.com/product/rosalee-copy/", categories: [{ name: "Copyshop" }] },
    ]
    const collapsed = es.collapseByDesign(es.extractPatternProducts(products))
    ok("ES: knitting + copyshop excluded, Josie pair collapsed to 1", collapsed.length === 1)
    ok("ES: PDF canonical", collapsed[0].url.endsWith("/product/josie-pdf/"))
  }

  console.log("\n--- Elemeno: og/JSON-LD/slug fallback chain ---")
  {
    ok("Elemeno: slug is trailing segment", elemeno.elemenoSlug("https://www.elemenopatterns.com/product-page/cross-back-dress") === "cross-back-dress")
    ok("Elemeno: slugToTitle title-cases", elemeno.slugToTitle("cross-back-dress") === "Cross-back Dress")
    const ogPage = elemeno.parseProductPage({ url: "https://www.elemenopatterns.com/product-page/ruffle-romper", html: '<meta property="og:title" content="Ruffle Romper | elemenopatterns"><meta property="og:image" content="https://img/r.jpg">' })
    ok("Elemeno: og:title wins, suffix stripped", ogPage.name === "Ruffle Romper")
    ok("Elemeno: og:image used", ogPage.imageUrl === "https://img/r.jpg")
    const shellPage = elemeno.parseProductPage({ url: "https://www.elemenopatterns.com/product-page/hipster-romper", html: "<title></title>" })
    ok("Elemeno: empty shell falls back to slug title", shellPage.name === "Hipster Romper")
  }

  console.log("\n--- Atelier Scammit: PrestaShop id + h1 title-case + classify ---")
  {
    ok("Scammit: product id extracted", scammit.scammitProductId("https://www.atelier-scammit.com/women/124-declic.html") === "124")
    ok("Scammit: identityKey keys on id (category-independent)", scammit.atelierScammitAdapter.identityKey?.("https://www.atelier-scammit.com/free-patterns/124-declic.html") === "124")
    ok("Scammit: titleCase de-shouts", scammit.titleCase("MOBILE COEURS") === "Mobile Coeurs")
    ok("Scammit: garment is a pattern", scammit.classify("Declic", "women") === "pattern")
    ok("Scammit: woven-labels segment flagged other", scammit.classify("Kit 4 Woven Labels", "woven-labels") === "other")
    ok("Scammit: gift card name flagged other", scammit.classify("Gift Card", "women") === "other")
    const parsed = scammit.parseProductPage({ url: "https://www.atelier-scammit.com/women/124-declic.html", html: '<h1>DECLIC</h1><meta property="og:image" content="https://img/d.jpg">' })
    ok("Scammit: parses h1 -> title-cased name + id source", parsed?.name === "Declic" && parsed?.sourceId === "124")
  }

  // --- live catalogue fetches ---------------------------------------------
  console.log("\n--- live: Atelier Jupe (Shopify) ---")
  const jupeCat = await jupe.atelierJupeAdapter.fetchCatalogue()
  console.log(`  ${jupeCat.length} designs`)
  assertCommonShape("Jupe", jupeCat, /^https:\/\/atelierjupe\.com\/products\//)
  ok("Jupe: ~46 designs (40-55)", jupeCat.length >= 40 && jupeCat.length <= 55)
  ok("Jupe: no format word left in any name", jupeCat.every((p) => !/\b(pdf|paper)\b/i.test(p.name)))
  ok("Jupe: most designs have a real release date", jupeCat.filter((p) => p.releaseDate).length >= jupeCat.length * 0.8)

  console.log("\n--- live: Emporia (Shopify) ---")
  const emporiaCat = await emporia.emporiaAdapter.fetchCatalogue()
  console.log(`  ${emporiaCat.length} designs`)
  assertCommonShape("Emporia", emporiaCat, /^https:\/\/emporia-fabric\.co\.uk\/products\//)
  ok("Emporia: ~18 designs (14-24)", emporiaCat.length >= 14 && emporiaCat.length <= 24)
  ok("Emporia: no 'Emporia Patterns' prefix left in names", emporiaCat.every((p) => !/^emporia\s+patterns/i.test(p.name)))

  console.log("\n--- live: Experimental Space (WooCommerce) ---")
  const esCat = await es.experimentalSpaceAdapter.fetchCatalogue()
  console.log(`  ${esCat.length} designs: ${esCat.map((p) => p.name).join(", ")}`)
  assertCommonShape("ES", esCat, /^https:\/\/experimentalspace\.com\//)
  ok("ES: ~6 sewing designs (4-10)", esCat.length >= 4 && esCat.length <= 10)
  ok("ES: no knitting designs leaked (no 'sweater'/'cardigan')", esCat.every((p) => !/\b(sweater|cardigan|shawl|beanie)\b/i.test(p.name)))

  console.log("\n--- live: Elemeno Patterns (Wix) ---")
  const elemenoCat = await elemeno.elemenoPatternsAdapter.fetchCatalogue()
  console.log(`  ${elemenoCat.length} products`)
  assertCommonShape("Elemeno", elemenoCat, /^https:\/\/www\.elemenopatterns\.com\/product-page\//)
  ok("Elemeno: ~26 products (20-32)", elemenoCat.length >= 20 && elemenoCat.length <= 32)
  ok("Elemeno: most have an image (>= 90%)", elemenoCat.filter((p) => p.imageUrl).length >= elemenoCat.length * 0.9)

  console.log("\n--- live: Atelier Scammit (PrestaShop) ---")
  const scammitCat = await scammit.atelierScammitAdapter.fetchCatalogue()
  const scammitPatterns = scammitCat.filter((p) => p.kind === "pattern")
  const scammitOther = scammitCat.filter((p) => p.kind === "other")
  console.log(`  ${scammitCat.length} products (pattern=${scammitPatterns.length}, other=${scammitOther.length})`)
  assertCommonShape("Scammit", scammitCat, /^https:\/\/www\.atelier-scammit\.com\/[a-z0-9-]+\/\d+-/)
  ok("Scammit: ~83 products (70-95)", scammitCat.length >= 70 && scammitCat.length <= 95)
  ok("Scammit: every product has an image", scammitCat.every((p) => !!p.imageUrl))
  ok("Scammit: no ALL-CAPS names left (title-cased)", scammitCat.every((p) => p.name !== p.name.toUpperCase() || p.name.length <= 3))
  ok("Scammit: at least one non-pattern flagged (woven labels)", scammitOther.length >= 1)

  console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
