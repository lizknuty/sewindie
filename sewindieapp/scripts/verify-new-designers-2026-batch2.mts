import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

import * as grainline from "../app/lib/pattern-sync/adapters/grainline-studio"
import * as freshpress from "../app/lib/pattern-sync/adapters/fresh-press-patterns"
import * as halla from "../app/lib/pattern-sync/adapters/halla-patterns"
import * as goldfinch from "../app/lib/pattern-sync/adapters/goldfinch-textile-studio"

// ---------------------------------------------------------------------------
// Verifies the second 2026 batch of six requested designers. Four are built
// (Grainline Studio, Fresh Press Patterns, Halla Patterns -- all Shopify; and
// Goldfinch Textile Studio -- Squarespace). Two are intentionally NOT built:
//   - Hey June Handmade: Cloudflare 403-challenges every server-side request
//     (home, wc/store/v1, sitemaps) under every UA -- same tar-pit class as Rad
//     Patterns. A serverless adapter cannot clear the JS challenge.
//   - Fehr Trade: the Shopify shop (shop.fehrtrade.com) was shut down and now
//     301-redirects to the dead blog; the only live storefronts are Etsy (403
//     tar-pit) and PatternReview (403). No scrapable source remains.
// See the pattern-sync memory note.
//
// All four built are fresh backfills (~0 existing rows), so there is nothing to
// reconcile; checks cover registry resolution, offline unit tests of the
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
  ok(
    `${label}: every pattern has an image`,
    scraped.filter((p) => p.kind === "pattern").every((p) => !!p.imageUrl),
  )
}

function resolves(url: string, expectedSlug: string) {
  const adapter: DesignerAdapter | null = getAdapterForDesigner({ url })
  ok(`registry: ${url} -> ${expectedSlug}`, adapter?.slug === expectedSlug)
}

async function main() {
  console.log("=== 2026 new-designers batch 2 verification ===\n")

  // --- registry resolution ------------------------------------------------
  console.log("--- registry resolution ---")
  resolves("https://grainlinestudio.com/", "grainline-studio")
  resolves("https://freshpresspatterns.com/", "fresh-press-patterns")
  resolves("https://www.hallapatterns.com/", "halla-patterns")
  resolves("https://www.goldfinch.design/", "goldfinch-textile-studio")

  // --- offline unit tests -------------------------------------------------
  console.log("\n--- Grainline: type filter + size-range collapse ---")
  {
    const products: grainline.ShopifyProduct[] = [
      { id: 1, title: "Poppy Dress 0–18", handle: "poppy-0-18", product_type: "Pattern", published_at: "2022-03-01T00:00:00Z", images: [{ src: "p.jpg" }] },
      { id: 2, title: "Poppy Dress 14–32", handle: "poppy-14-32", product_type: "Pattern", published_at: "2022-03-01T00:00:00Z", images: [{ src: "p2.jpg" }] },
      { id: 3, title: "Free Tote Bag", handle: "free-tote", product_type: "Free", images: [{ src: "t.jpg" }] },
      { id: 4, title: "Pattern Notcher", handle: "notcher", product_type: "Supply" },
      { id: 5, title: "Gift Card", handle: "gc", product_type: "Gift Card" },
    ]
    const extracted = grainline.extractPatternProducts(products)
    ok("Grainline: keeps Pattern+Free, drops Supply+Gift Card", extracted.length === 3)
    ok("Grainline: designStem strips en-dash size range", grainline.designStem("Poppy Dress 14–32") === "Poppy Dress")
    ok("Grainline: designStem strips hyphen size range", grainline.designStem("Austin Dress 0-18") === "Austin Dress")
    ok("Grainline: designStem leaves rangeless titles", grainline.designStem("Field Bag") === "Field Bag")
    const collapsed = grainline.collapseByDesign(extracted)
    ok("Grainline: collapses the two Poppy listings", collapsed.length === 2)
    const poppy = collapsed.find((p) => p.name === "Poppy Dress")
    ok("Grainline: Poppy design name has no size range", !!poppy)
    ok("Grainline: keeps the real release date", poppy?.releaseDate === "2022-03-01T00:00:00Z")
    ok("Grainline: free pattern kept as a pattern", collapsed.some((p) => p.name === "Free Tote Bag" && p.kind === "pattern"))
  }

  console.log("\n--- Fresh Press: garment-type filter ---")
  {
    const products: freshpress.ShopifyProduct[] = [
      { id: 1, title: "Milly Dress", handle: "milly", product_type: "Dress", images: [{ src: "m.jpg" }] },
      { id: 2, title: "June Cami", handle: "june", product_type: "Cami", images: [{ src: "j.jpg" }] },
      { id: 3, title: "ROLLS END Abstract Print Jersey 2.9m", handle: "fabric-1", product_type: "" },
      { id: 4, title: "Digital Gift Card", handle: "gc", product_type: "Gift Card" },
    ]
    ok("FreshPress: garment types are patterns", freshpress.isPattern(products[0]) && freshpress.isPattern(products[1]))
    ok("FreshPress: empty-type fabric excluded", !freshpress.isPattern(products[2]))
    ok("FreshPress: gift card excluded", !freshpress.isPattern(products[3]))
    const patterns = freshpress.toPatterns(products)
    ok("FreshPress: keeps exactly the 2 patterns", patterns.length === 2)
  }

  console.log("\n--- Halla: audience filter + title-case, no for-X collapse ---")
  {
    const products: halla.ShopifyProduct[] = [
      { id: 1, title: "twirly skirt for women", handle: "twirly-women", product_type: "women", images: [{ src: "w.jpg" }] },
      { id: 2, title: "twirly skirt for kids", handle: "twirly-kids", product_type: "kids", images: [{ src: "k.jpg" }] },
      { id: 3, title: "rachael top & dress for women", handle: "rachael", product_type: "women", images: [{ src: "r.jpg" }] },
      { id: 4, title: "gift cards", handle: "gc", product_type: "Gift Card" },
    ]
    ok("Halla: titleCase capitalises each word, keeps &", halla.titleCase("rachael top & dress for women") === "Rachael Top & Dress For Women")
    const patterns = halla.toPatterns(products)
    ok("Halla: keeps the 3 patterns, drops gift card", patterns.length === 3)
    ok("Halla: for-women and for-kids stay separate", patterns.some((p) => /For Women$/.test(p.name)) && patterns.some((p) => /For Kids$/.test(p.name)))
  }

  console.log("\n--- Goldfinch: Squarespace item mapping ---")
  {
    const item: goldfinch.SquarespaceItem = {
      id: "abc123",
      recordType: 11,
      title: "Jones Trousers – Zero/Minimal Waste Digital Sewing Pattern",
      fullUrl: "/shop/p/jones-trousers",
      assetUrl: "https://images.squarespace-cdn.com/x/jones.jpg",
      publishOn: 1774012243032,
    }
    const mapped = goldfinch.itemToPattern(item)
    ok("Goldfinch: maps title verbatim", mapped?.name === "Jones Trousers – Zero/Minimal Waste Digital Sewing Pattern")
    ok("Goldfinch: builds absolute URL", mapped?.url === "https://www.goldfinch.design/shop/p/jones-trousers")
    ok("Goldfinch: keeps the CDN image", mapped?.imageUrl === "https://images.squarespace-cdn.com/x/jones.jpg")
    ok("Goldfinch: converts epoch-ms publishOn to ISO", mapped?.releaseDate === new Date(1774012243032).toISOString())
    ok("Goldfinch: publishOnToIso handles undefined", goldfinch.publishOnToIso(undefined) === null)
    ok("Goldfinch: gift card flagged other", goldfinch.itemToPattern({ id: "g", title: "Gift Card", fullUrl: "/shop/p/gc" })?.kind === "other")
  }

  // --- live catalogue fetches --------------------------------------------
  console.log("\n--- Grainline (live) ---")
  const grainlineCat = await grainline.grainlineStudioAdapter.fetchCatalogue()
  assertCommonShape("Grainline", grainlineCat, /^https:\/\/grainlinestudio\.com\/products\//)
  ok(`Grainline: ~49 designs (40-60), got ${grainlineCat.length}`, grainlineCat.length >= 40 && grainlineCat.length <= 60)
  ok("Grainline: no size range leaked into any name", grainlineCat.every((p) => !/\s\d{1,2}\s*[-–]\s*\d{1,2}$/.test(p.name)))

  console.log("\n--- Fresh Press (live) ---")
  const freshCat = await freshpress.freshPressPatternsAdapter.fetchCatalogue()
  assertCommonShape("FreshPress", freshCat, /^https:\/\/freshpresspatterns\.com\/products\//)
  ok(`FreshPress: ~9 patterns (5-15), got ${freshCat.length}`, freshCat.length >= 5 && freshCat.length <= 15)
  ok("FreshPress: no fabric leaked (no 'ROLLS END'/'Deadstock')", freshCat.every((p) => !/rolls end|deadstock|jersey|brocade|jacquard|mesh/i.test(p.name)))

  console.log("\n--- Halla (live) ---")
  const hallaCat = await halla.hallaPatternsAdapter.fetchCatalogue()
  assertCommonShape("Halla", hallaCat, /^https:\/\/www\.hallapatterns\.com\/products\//)
  ok(`Halla: ~44 patterns (35-55), got ${hallaCat.length}`, hallaCat.length >= 35 && hallaCat.length <= 55)
  ok("Halla: names are title-cased (first letter upper)", hallaCat.every((p) => /^[A-Z0-9]/.test(p.name)))

  console.log("\n--- Goldfinch (live) ---")
  const goldfinchCat = await goldfinch.goldfinchTextileStudioAdapter.fetchCatalogue()
  assertCommonShape("Goldfinch", goldfinchCat, /^https:\/\/www\.goldfinch\.design\/shop\/p\//)
  ok(`Goldfinch: ~8 patterns (5-20), got ${goldfinchCat.length}`, goldfinchCat.length >= 5 && goldfinchCat.length <= 20)
  ok("Goldfinch: every pattern has a release date", goldfinchCat.filter((p) => p.kind === "pattern").every((p) => !!p.releaseDate))

  console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("verification crashed:", err)
  process.exit(1)
})
