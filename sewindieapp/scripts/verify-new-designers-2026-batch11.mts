// Verify batch 11 designer adapters: live catalogue crawls (run SEQUENTIALLY to
// avoid hammering hosts) + offline unit tests of the name cleaners.
//
//   npx tsx scripts/verify-new-designers-2026-batch11.mts

import { closetCoreAdapter } from "../app/lib/pattern-sync/adapters/closet-core"
import { deerAndDoeAdapter } from "../app/lib/pattern-sync/adapters/deer-and-doe"
import { cleanClosetCoreName } from "../app/lib/pattern-sync/adapters/closetcore-store"
import { dhurataDaviesAdapter, cleanDhurataName } from "../app/lib/pattern-sync/adapters/dhurata-davies"
import { heidiAndFinnAdapter, cleanHeidiFinnName } from "../app/lib/pattern-sync/adapters/heidi-and-finn"
import { helensClosetAdapter, cleanHelensClosetName } from "../app/lib/pattern-sync/adapters/helens-closet"
import { commonStitchAdapter, cleanCommonStitchName } from "../app/lib/pattern-sync/adapters/common-stitch"
import { christineHaynesAdapter, cleanChristineHaynesName } from "../app/lib/pattern-sync/adapters/christine-haynes"
import { dressYourBodyAdapter, cleanDressYourBodyName } from "../app/lib/pattern-sync/adapters/dress-your-body"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) failures++
}

function assertCatalogue(name: string, items: ScrapedPattern[], min: number, max: number, imgPct = 0.95) {
  check(`${name}: count in [${min}, ${max}] (got ${items.length})`, items.length >= min && items.length <= max)
  check(`${name}: all have non-empty name`, items.every((p) => !!p.name && p.name.trim().length > 0))
  check(`${name}: all have url`, items.every((p) => /^https?:\/\//.test(p.url)))
  const withImage = items.filter((p) => p.imageUrl != null && /^https?:\/\//.test(p.imageUrl)).length
  check(`${name}: >=${Math.round(imgPct * 100)}% have http image (${withImage}/${items.length})`, withImage >= Math.ceil(items.length * imgPct))
  check(`${name}: unique sourceIds`, new Set(items.map((p) => p.sourceId)).size === items.length)
  check(
    `${name}: valid kinds`,
    items.every((p) => ["pattern", "bundle", "addon", "bonus", "other"].includes(p.kind)),
  )
}

async function crawl(adapter: DesignerAdapter): Promise<ScrapedPattern[]> {
  try {
    return await adapter.fetchCatalogue()
  } catch (error) {
    console.log(`  !! ${adapter.label} crawl threw: ${(error as Error).message}`)
    return []
  }
}

function unitTests() {
  console.log("\n--- offline unit tests ---")
  // Closet Core: "- Crew Pattern" suffix stripped so format twins collapse.
  check(
    "cleanClosetCoreName strips crew suffix",
    cleanClosetCoreName("Therese Track Pants - Crew Pattern") === "Therese Track Pants",
  )
  // Dhurata: digital/paper twins collapse to base name.
  check(
    "cleanDhurataName drops format + tail",
    cleanDhurataName("Hattie Bag digital sewing pattern, PDF") === "Hattie Bag",
  )
  // Heidi & Finn: strip PDF pattern tail.
  check(
    "cleanHeidiFinnName strips pdf tail",
    /^Reversible Bucket Hat$/i.test(cleanHeidiFinnName("Reversible Bucket Hat - PDF Sewing Pattern")),
  )
  // Helen's Closet: keep name, drop (FREE) marker.
  check(
    "cleanHelensClosetName drops FREE marker",
    cleanHelensClosetName("Horizon Tank (FREE)") === "Horizon Tank",
  )
  // Common Stitch: PAPER/DIGITAL twins collapse.
  check(
    "cleanCommonStitchName drops format + pattern",
    cleanCommonStitchName("Lilly Pilly Dress + Top PAPER Pattern") === "Lilly Pilly Dress + Top",
  )
  // Christine Haynes: strip digital sewing pattern tail.
  check(
    "cleanChristineHaynesName strips tail",
    cleanChristineHaynesName("James Tee - Digital Sewing Pattern") === "James Tee",
  )
  // Dress Your Body: strip leading "Patron".
  check(
    "cleanDressYourBodyName strips Patron prefix",
    cleanDressYourBodyName("Patron pantalon Orel") === "pantalon Orel",
  )
}

async function main() {
  console.log("--- live catalogue crawls (sequential) ---")
  const closet = await crawl(closetCoreAdapter)
  assertCatalogue("Closet Core", closet, 60, 110)
  const deer = await crawl(deerAndDoeAdapter)
  assertCatalogue("Deer and Doe", deer, 35, 70)
  // The two share one store split by vendor -> their sourceIds must be disjoint.
  const overlap = new Set(closet.map((p) => p.sourceId))
  const shared = deer.filter((p) => overlap.has(p.sourceId)).length
  check(`Closet Core / Deer and Doe vendor split is disjoint (shared=${shared})`, shared === 0)

  assertCatalogue("Dhurata Davies", await crawl(dhurataDaviesAdapter), 18, 40)
  assertCatalogue("Heidi and Finn", await crawl(heidiAndFinnAdapter), 200, 400)
  assertCatalogue("Helen's Closet", await crawl(helensClosetAdapter), 35, 70)
  assertCatalogue("Common Stitch", await crawl(commonStitchAdapter), 20, 60, 0.9)
  assertCatalogue("Christine Haynes", await crawl(christineHaynesAdapter), 10, 30)
  assertCatalogue("Dress Your Body", await crawl(dressYourBodyAdapter), 30, 60, 0.9)

  unitTests()

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " CHECK(S) FAILED"}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
