/**
 * Verify the 2026 batch-4 designer adapters (Halfmoon Atelier, Greyfriars and
 * Grace, Homer + Howells, In the Folds) against their live sources, plus
 * offline unit tests for the name-cleaning helpers.
 *
 * Run: npx tsx scripts/verify-new-designers-2026-batch4.mts
 */
import { halfmoonAtelierAdapter, cleanName as halfmoonClean } from "../app/lib/pattern-sync/adapters/halfmoon-atelier"
import { greyfriarsAndGraceAdapter, cleanName as greyfriarsClean } from "../app/lib/pattern-sync/adapters/greyfriars-and-grace"
import { homerAndHowellsAdapter, cleanName as homerClean } from "../app/lib/pattern-sync/adapters/homer-and-howells"
import { inTheFoldsAdapter, classify as itfClassify } from "../app/lib/pattern-sync/adapters/in-the-folds"
import type { ScrapedPattern } from "../app/lib/pattern-sync/types"

let passed = 0
let failed = 0
function ok(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`)
  }
}

function commonChecks(label: string, cat: ScrapedPattern[]) {
  const patterns = cat.filter((p) => p.kind === "pattern")
  ok(`${label}: all have a name`, cat.every((p) => !!p.name && p.name.trim().length > 0))
  ok(`${label}: all have an absolute url`, cat.every((p) => /^https?:\/\//.test(p.url)))
  ok(`${label}: all have a sourceId`, cat.every((p) => !!p.sourceId))
  ok(`${label}: every PATTERN has an image`, patterns.every((p) => !!p.imageUrl))
  ok(`${label}: no duplicate urls`, new Set(cat.map((p) => p.url)).size === cat.length)
  ok(`${label}: names carry no leftover format tail`, cat.every((p) => !/\|/.test(p.name)))
  return patterns
}

async function main() {
  // ---- Offline unit tests: name cleaners ---------------------------------
  console.log("\n== unit: Halfmoon cleanName ==")
  ok("drops '| PDF sewing pattern'", halfmoonClean("STRAND dress + top | PDF sewing pattern") === "STRAND dress + top")
  ok("drops '| PDF pattern'", halfmoonClean("boat neck ANEGADA | PDF pattern") === "boat neck ANEGADA")
  ok("keeps a name with no bar", halfmoonClean("halfmoon 101 JEANS") === "halfmoon 101 JEANS")

  console.log("\n== unit: Homer + Howells cleanName ==")
  ok("drops trailing ' PDF'", homerClean("Ingrid PDF") === "Ingrid")
  ok("drops '- FREE'", homerClean("Beginner Pocket Pack - FREE") === "Beginner Pocket Pack")
  ok("leaves a plain name", homerClean("Lennox") === "Lennox")

  console.log("\n== unit: Greyfriars cleanName ==")
  ok(
    "cuts descriptive tail after ' - '",
    greyfriarsClean("Shirt to Stockbridge Top Sewing Pattern - How to refashion a work shirt") ===
      "Shirt to Stockbridge Top",
  )
  ok(
    "drops marketing parenthetical",
    greyfriarsClean("Cairngorm Collar Top Sewing Pattern (Shirt Upcycle with YouTube video)") === "Cairngorm Collar Top",
  )
  ok("keeps '(Adult)' size qualifier", /\(Adult\)/i.test(greyfriarsClean("Stornoway Cape (Adult)")))
  ok(
    "keeps '(Ages 2-9)' and strips 'Sewing Pattern'",
    greyfriarsClean("Stornoway Cape Sewing Pattern (Ages 2-9)") === "Stornoway Cape (Ages 2-9)",
  )
  ok(
    "adult vs kids stay distinct",
    greyfriarsClean("Easy Nova Scotia Skirt Sewing Pattern (Adult) - with optional pockets") !==
      greyfriarsClean("Nova Scotia Skirt (Age 2-16) - Easy no buttons"),
  )
  ok("drops '& YouTube video'", greyfriarsClean("Edinburgh Bag - Sewing Pattern & YouTube video") === "Edinburgh Bag")

  console.log("\n== unit: In the Folds classify ==")
  ok("Resources -> other", itfClassify("Resources", "Sewing Mindset Journal") === "other")
  ok("Gift Cards -> other", itfClassify("Gift Cards", "In the Folds gift card") === "other")
  ok("bundle title -> bundle", itfClassify("Dresses", "Acton Dress Bundle (Pattern + Sleeve Hack Expansion)") === "bundle")
  ok("garment-typed Hack -> other", itfClassify("Dresses", "Acton Dress Hack (Sleeve Expansion)") === "other")
  ok("plain garment -> pattern", itfClassify("Dresses", "Rushcutter dress") === "pattern")

  // ---- Live: Halfmoon Atelier --------------------------------------------
  console.log("\n== live: Halfmoon Atelier (Shopify) ==")
  const halfmoon = await halfmoonAtelierAdapter.fetchCatalogue()
  console.log(`  fetched ${halfmoon.length} products`)
  const halfmoonPatterns = commonChecks("Halfmoon", halfmoon)
  ok("Halfmoon: ~13 products (10-16)", halfmoon.length >= 10 && halfmoon.length <= 16)
  ok("Halfmoon: no Ceramic Mug leaked", halfmoon.every((p) => !/mug|ceramic/i.test(p.name)))
  ok("Halfmoon: has >= 1 bundle", halfmoon.some((p) => p.kind === "bundle"))
  ok("Halfmoon: patterns have real dates", halfmoonPatterns.every((p) => !!p.releaseDate))

  // ---- Live: Greyfriars and Grace ----------------------------------------
  console.log("\n== live: Greyfriars and Grace (Squarespace /patterns) ==")
  const greyfriars = await greyfriarsAndGraceAdapter.fetchCatalogue()
  console.log(`  fetched ${greyfriars.length} products`)
  commonChecks("Greyfriars", greyfriars)
  ok("Greyfriars: ~20 patterns (15-28)", greyfriars.length >= 15 && greyfriars.length <= 28)
  ok("Greyfriars: names are trimmed (<= 60 chars)", greyfriars.every((p) => p.name.length <= 60))
  ok("Greyfriars: no leftover ' - ' sentence tail", greyfriars.every((p) => !/\s[-–]\s/.test(p.name)))
  ok("Greyfriars: patterns have real dates", greyfriars.every((p) => !!p.releaseDate))

  // ---- Live: Homer + Howells ---------------------------------------------
  console.log("\n== live: Homer + Howells (Squarespace /shop-online) ==")
  const homer = await homerAndHowellsAdapter.fetchCatalogue()
  console.log(`  fetched ${homer.length} products`)
  commonChecks("Homer", homer)
  ok("Homer: ~8 patterns (5-14)", homer.length >= 5 && homer.length <= 14)
  ok("Homer: no trailing ' PDF' in names", homer.every((p) => !/\bpdf$/i.test(p.name)))
  ok("Homer: patterns have real dates", homer.every((p) => !!p.releaseDate))

  // ---- Live: In the Folds ------------------------------------------------
  console.log("\n== live: In the Folds (Shopify shop.inthefolds.com) ==")
  const itf = await inTheFoldsAdapter.fetchCatalogue()
  console.log(`  fetched ${itf.length} products`)
  const itfPatterns = commonChecks("In the Folds", itf)
  ok("In the Folds: 40-60 total products", itf.length >= 40 && itf.length <= 60)
  ok("In the Folds: 18-40 patterns", itfPatterns.length >= 18 && itfPatterns.length <= 40)
  ok("In the Folds: has >= 1 bundle", itf.some((p) => p.kind === "bundle"))
  ok("In the Folds: has >= 1 other (Resources/Gift Card)", itf.some((p) => p.kind === "other"))
  ok("In the Folds: gift card flagged other", itf.every((p) => !/gift\s*card/i.test(p.name) || p.kind === "other"))
  ok("In the Folds: no journal/planner as pattern", itfPatterns.every((p) => !/journal|planner/i.test(p.name)))
  ok("In the Folds: pattern urls on shop subdomain", itfPatterns.every((p) => /shop\.inthefolds\.com/.test(p.url)))

  console.log(`\n==== ${passed} passed, ${failed} failed ====`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
