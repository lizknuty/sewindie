import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

import * as fieldwork from "../app/lib/pattern-sync/adapters/fieldwork-patterns"
import * as forgetmenot from "../app/lib/pattern-sync/adapters/forget-me-not-patterns"
import * as friday from "../app/lib/pattern-sync/adapters/friday-pattern-company"
import * as frenchnavy from "../app/lib/pattern-sync/adapters/french-navy"
import * as fitiyoo from "../app/lib/pattern-sync/adapters/fitiyoo"

// ---------------------------------------------------------------------------
// Verifies the third 2026 batch of seven requested designers. Five are built:
//   - Fieldwork Patterns        (Shopify, title-based "- Sewing Pattern" filter)
//   - Forget-me-not Patterns    (Shopify, whole store is patterns)
//   - Friday Pattern Company    (Shopify, PDF/Printed format-pair collapse)
//   - French Navy               (Wix, sitemap + og/JSON-LD, drops copy-of drafts)
//   - Fitiyoo                   (bespoke platform, sitemap leaves + og/JSON-LD)
// Two are intentionally NOT built:
//   - Fig + Needle: the storefront is a Treadlet client-rendered SPA. The
//     server HTML carries no product data, no __NEXT_DATA__/flight payload, and
//     none of the 12 JS bundles reference a reachable product API base -- a
//     serverless adapter cannot enumerate products without a real browser.
//   - Fabric Godmother: Cloudflare JS-challenges every server-side request, and
//     it is a fabric retailer/reseller rather than a pattern designer.
// See the pattern-sync memory note.
//
// All five built are fresh backfills (~0 existing rows), so there is nothing to
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
  console.log("=== 2026 new-designers batch 3 verification ===\n")

  // --- registry resolution ------------------------------------------------
  console.log("--- registry resolution ---")
  resolves("https://fieldworkpatterns.com/en-us", "fieldwork-patterns")
  resolves("https://forgetmenotpatterns.com/", "forget-me-not-patterns")
  resolves("https://fridaypatterncompany.com/", "friday-pattern-company")
  resolves("https://www.frenchnavypatterns.com/", "french-navy")
  resolves("https://www.fitiyoo.com/en/", "fitiyoo")

  // --- Fieldwork offline ---------------------------------------------------
  console.log("\n--- Fieldwork: title filter + de-shout name ---")
  {
    ok("Fieldwork: isPattern true for a house pattern", fieldwork.isPattern("09 BETH - Boxy Top - Sewing Pattern"))
    ok("Fieldwork: isPattern false for a machine", !fieldwork.isPattern("Janome CoverPro 3000"))
    ok("Fieldwork: cleanName strips seq + tag + de-shouts", fieldwork.cleanName("09 BETH - Boxy Top - Sewing Pattern") === "Beth - Boxy Top")
    ok("Fieldwork: cleanName drops FREE tail", fieldwork.cleanName("05 MILLIE - Jogger - Sewing Pattern - FREE to Newsletter Subscribers") === "Millie - Jogger")
    const products: fieldwork.ShopifyProduct[] = [
      { id: 1, title: "09 BETH - Boxy Top - Sewing Pattern", handle: "beth", published_at: "2023-01-01T00:00:00Z", images: [{ src: "b.jpg" }] },
      { id: 2, title: "Janome CoverPro 3000", handle: "janome-cp", images: [{ src: "j.jpg" }] },
      { id: 3, title: "PDF Pattern Printing", handle: "printing" },
      { id: 4, title: "Fieldwork Gift Card", handle: "gc" },
    ]
    const patterns = fieldwork.toPatterns(products)
    ok("Fieldwork: keeps only the house pattern", patterns.length === 1 && patterns[0].name === "Beth - Boxy Top")
    ok("Fieldwork: sourceId is the sequence number", patterns[0].sourceId === "09")
  }

  // --- Forget-me-not offline ----------------------------------------------
  console.log("\n--- Forget-me-not: strip format parenthetical ---")
  {
    ok("FMN: strips (PDF pattern)", forgetmenot.cleanName("Clementine - Knit dress and top (PDF pattern)") === "Clementine - Knit dress and top")
    ok("FMN: strips (Free PDF pattern)", forgetmenot.cleanName("Vera - Knit top (Free PDF pattern)") === "Vera - Knit top")
    ok("FMN: strips (Pay-what-you-can PDF Pattern)", forgetmenot.cleanName("Rosalie Skirt Expansion - Darted pattern pieces (Pay-what-you-can PDF Pattern)") === "Rosalie Skirt Expansion - Darted pattern pieces")
    const products: forgetmenot.ShopifyProduct[] = [
      { id: 1, title: "Ella - Skirt (PDF pattern)", handle: "ella", published_at: "2022-05-01T00:00:00Z", images: [{ src: "e.jpg" }] },
      { id: 2, title: "Vera - Knit top (Free PDF pattern)", handle: "vera", images: [{ src: "v.jpg" }] },
    ]
    const patterns = forgetmenot.toPatterns(products)
    ok("FMN: keeps both, names cleaned", patterns.length === 2 && patterns.every((p) => !/\(/.test(p.name)))
    ok("FMN: all kind pattern", patterns.every((p) => p.kind === "pattern"))
  }

  // --- Friday offline ------------------------------------------------------
  console.log("\n--- Friday: type classify + format-pair collapse ---")
  {
    ok("Friday: PDF type -> pattern", friday.kindForType("PDF Patterns") === "pattern")
    ok("Friday: Printed type -> pattern", friday.kindForType("Printed Patterns") === "pattern")
    ok("Friday: Bundle -> bundle", friday.kindForType("Bundle") === "bundle")
    ok("Friday: empty -> other", friday.kindForType("") === "other")
    ok("Friday: designStem strips PDF suffix", friday.designStem("Uma Dress and Top - PDF Pattern") === "Uma Dress and Top")
    ok("Friday: designStem strips Printed suffix", friday.designStem("Uma Dress and Top - Printed Pattern") === "Uma Dress and Top")
    const products: friday.ShopifyProduct[] = [
      { id: 1, title: "Uma Dress and Top - PDF Pattern", handle: "uma-pdf", product_type: "PDF Patterns", published_at: "2021-01-01T00:00:00Z", images: [{ src: "u.jpg" }] },
      { id: 2, title: "Uma Dress and Top - Printed Pattern", handle: "uma-printed", product_type: "Printed Patterns", published_at: "2021-02-01T00:00:00Z", images: [{ src: "u2.jpg" }] },
      { id: 3, title: "The Best Seller Bundle - PDF Patterns", handle: "bundle", product_type: "Bundle", images: [{ src: "b.jpg" }] },
      { id: 4, title: "Rippy Sticker", handle: "sticker", product_type: "" },
    ]
    const collapsed = friday.collapse(friday.classifyProducts(products))
    ok("Friday: Uma collapses to one design", collapsed.filter((p) => p.name === "Uma Dress and Top").length === 1)
    const uma = collapsed.find((p) => p.name === "Uma Dress and Top")
    ok("Friday: PDF listing wins as canonical", uma?.url.endsWith("/uma-pdf"))
    ok("Friday: bundle kept as kind bundle", collapsed.some((p) => p.kind === "bundle"))
    ok("Friday: sticker kept as kind other", collapsed.some((p) => p.name === "Rippy Sticker" && p.kind === "other"))
    ok("Friday: total rows = 3 (uma + bundle + sticker)", collapsed.length === 3)
  }

  // --- French Navy offline -------------------------------------------------
  console.log("\n--- French Navy: slug + draft drop + parse ---")
  {
    ok("FN: slug from product-page URL", frenchnavy.frenchNavySlug("https://www.frenchnavypatterns.com/product-page/the-seneca-shirt") === "the-seneca-shirt")
    ok("FN: isDraftSlug true for copy-of", frenchnavy.isDraftSlug("copy-of-the-morningside-shirt"))
    ok("FN: isDraftSlug false for real slug", !frenchnavy.isDraftSlug("the-bowery-top-pdf-sewing-pattern"))
    ok("FN: slugToTitle fallback", frenchnavy.slugToTitle("the-seneca-shirt") === "The Seneca Shirt")
    const page: frenchnavy.FrenchNavyProductPage = {
      url: "https://www.frenchnavypatterns.com/product-page/the-bowery-top-pdf-sewing-pattern",
      html: '<meta property="og:title" content="The Bowery Top PDF Sewing Pattern | French Navy Patterns"><meta property="og:image" content="https://static.wixstatic.com/media/bowery.jpg">',
    }
    const parsed = frenchnavy.parseProductPage(page)
    ok("FN: og:title suffix stripped", parsed.name === "The Bowery Top PDF Sewing Pattern")
    ok("FN: og:image captured", parsed.imageUrl === "https://static.wixstatic.com/media/bowery.jpg")
    ok("FN: slug is source id", parsed.sourceId === "the-bowery-top-pdf-sewing-pattern")
  }

  // --- Fitiyoo offline -----------------------------------------------------
  console.log("\n--- Fitiyoo: product-url filter + parse ---")
  {
    ok("Fitiyoo: leaf product url accepted", fitiyoo.isProductUrl("https://www.fitiyoo.com/en/lingerie-sewing-patterns/bras/smoothie-wireless-bra"))
    ok("Fitiyoo: category index rejected", !fitiyoo.isProductUrl("https://www.fitiyoo.com/en/lingerie-sewing-patterns/bras"))
    ok("Fitiyoo: unrelated url rejected", !fitiyoo.isProductUrl("https://www.fitiyoo.com/en/blog/how-to-sew-foam-cup-bra"))
    ok("Fitiyoo: slug extracted", fitiyoo.fitiyooSlug("https://www.fitiyoo.com/en/lingerie-sewing-patterns/bras/smoothie-wireless-bra") === "smoothie-wireless-bra")
    const page: fitiyoo.FitiyooProductPage = {
      url: "https://www.fitiyoo.com/en/lingerie-sewing-patterns/bras/smoothie-wireless-bra",
      html: '<meta property="og:title" content="Smoothie, wireless bra | Fitiyoo"><meta property="og:image" content="https://www.fitiyoo.com/images/patrons/smoothie.jpg"><script type="application/ld+json">{"@type":"product","name":"Smoothie, wireless bra"}</script>',
    }
    const parsed = fitiyoo.parseProductPage(page)
    ok("Fitiyoo: og:title suffix stripped", parsed.name === "Smoothie, wireless bra")
    ok("Fitiyoo: og:image captured", parsed.imageUrl === "https://www.fitiyoo.com/images/patrons/smoothie.jpg")
    ok("Fitiyoo: slug is source id", parsed.sourceId === "smoothie-wireless-bra")
  }

  // --- live catalogue fetches --------------------------------------------
  console.log("\n--- Fieldwork (live) ---")
  const fieldworkCat = await fieldwork.fieldworkPatternsAdapter.fetchCatalogue()
  assertCommonShape("Fieldwork", fieldworkCat, /^https:\/\/fieldworkpatterns\.com\/products\//)
  ok(`Fieldwork: ~9 patterns (5-15), got ${fieldworkCat.length}`, fieldworkCat.length >= 5 && fieldworkCat.length <= 15)
  ok("Fieldwork: no machines/classes leaked", fieldworkCat.every((p) => !/janome|overlocker|machine|class|printing|gift card/i.test(p.name)))

  console.log("\n--- Forget-me-not (live) ---")
  const fmnCat = await forgetmenot.forgetMeNotPatternsAdapter.fetchCatalogue()
  assertCommonShape("Forget-me-not", fmnCat, /^https:\/\/forgetmenotpatterns\.com\/products\//)
  ok(`Forget-me-not: ~20 patterns (12-30), got ${fmnCat.length}`, fmnCat.length >= 12 && fmnCat.length <= 30)
  ok("Forget-me-not: no format parenthetical leaked", fmnCat.every((p) => !/\(.*pattern.*\)/i.test(p.name)))

  console.log("\n--- Friday Pattern Company (live) ---")
  const fridayCat = await friday.fridayPatternCompanyAdapter.fetchCatalogue()
  assertCommonShape("Friday", fridayCat, /^https:\/\/fridaypatterncompany\.com\/products\//)
  const fridayPatterns = fridayCat.filter((p) => p.kind === "pattern")
  ok(`Friday: ~41 pattern designs (30-50), got ${fridayPatterns.length}`, fridayPatterns.length >= 30 && fridayPatterns.length <= 50)
  ok("Friday: no format suffix leaked into a pattern name", fridayPatterns.every((p) => !/[-–]\s*(pdf|printed)\s+pattern$/i.test(p.name)))

  console.log("\n--- French Navy (live) ---")
  const fnCat = await frenchnavy.frenchNavyAdapter.fetchCatalogue()
  assertCommonShape("French Navy", fnCat, /^https:\/\/www\.frenchnavypatterns\.com\/product-page\//)
  ok(`French Navy: ~30 patterns (20-45), got ${fnCat.length}`, fnCat.length >= 20 && fnCat.length <= 45)
  ok("French Navy: no copy-of drafts leaked", fnCat.every((p) => !/\/product-page\/copy-of-/i.test(p.url)))

  console.log("\n--- Fitiyoo (live) ---")
  const fitiyooCat = await fitiyoo.fitiyooAdapter.fetchCatalogue()
  assertCommonShape("Fitiyoo", fitiyooCat, /^https:\/\/www\.fitiyoo\.com\/en\/lingerie-sewing-patterns\//)
  ok(`Fitiyoo: ~23 patterns (15-30), got ${fitiyooCat.length}`, fitiyooCat.length >= 15 && fitiyooCat.length <= 30)
  ok("Fitiyoo: no blog/legal pages leaked", fitiyooCat.every((p) => !/\/blog\/|\/lingerie-sewing-tips\//i.test(p.url)))

  console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("verification crashed:", err)
  process.exit(1)
})
