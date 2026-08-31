// Verify batch 10 designer adapters: live catalogue crawls (run SEQUENTIALLY to
// avoid hammering hosts) + offline unit tests of the name cleaners.
//
//   npx tsx scripts/verify-new-designers-2026-batch10.mts

import { auraPatternsAdapter, cleanAuraName } from "../app/lib/pattern-sync/adapters/aura-patterns"
import { birgittaHelmerssonAdapter, cleanBirgittaName } from "../app/lib/pattern-sync/adapters/birgitta-helmersson"
import { blankSlatePatternsAdapter } from "../app/lib/pattern-sync/adapters/blank-slate-patterns"
import { byHandLondonAdapter, cleanByHandLondonName } from "../app/lib/pattern-sync/adapters/by-hand-london"
import { camimadeAdapter, cleanCamimadeName } from "../app/lib/pattern-sync/adapters/camimade"
import { cashmeretteAdapter, cleanCashmeretteName } from "../app/lib/pattern-sync/adapters/cashmerette"
import { chalkAndNotchAdapter, cleanChalkNotchName } from "../app/lib/pattern-sync/adapters/chalk-and-notch"
import { bobbinsAndButtonsAdapter } from "../app/lib/pattern-sync/adapters/bobbins-and-buttons"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  if (!ok) failures++
}

function assertCatalogue(name: string, items: ScrapedPattern[], min: number, max: number) {
  check(`${name}: count in [${min}, ${max}] (got ${items.length})`, items.length >= min && items.length <= max)
  check(`${name}: all have non-empty name`, items.every((p) => !!p.name && p.name.trim().length > 0))
  check(`${name}: all have url`, items.every((p) => /^https?:\/\//.test(p.url)))
  const withImage = items.filter((p) => p.imageUrl != null && /^https?:\/\//.test(p.imageUrl)).length
  check(`${name}: >=95% have http image (${withImage}/${items.length})`, withImage >= Math.ceil(items.length * 0.95))
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
  // Aura: pipe tail + descriptor
  check(
    "Aura: keep pre-pipe segment",
    cleanAuraName("Easy Cardigan Sewing Pattern | XS-XXXL | Digital PDF | Women's Jumper") === "Easy Cardigan",
  )
  check("Aura: strip trailing descriptor", cleanAuraName("Knot Bag Sewing Pattern") === "Knot Bag")
  // Birgitta: keep only PDF patterns, strip format tail
  check("Birgitta: strip PDF tail", cleanBirgittaName("Zero Waste Gather Dress - PDF Sewing Pattern") === "Zero Waste Gather Dress")
  // By Hand London: strip sewing pattern tail
  check(
    "ByHandLondon: strip pattern tail",
    cleanByHandLondonName("Orsola Dress Sewing Pattern") === "Orsola Dress",
  )
  // Camimade: keep design name, drop "pattern" + code suffix handling
  check(
    "Camimade: strip pattern word",
    cleanCamimadeName("Denim chore jacket pattern - VILLERS") === "Denim chore jacket - VILLERS",
  )
  // Cashmerette: collapse key
  check(
    "Cashmerette: format+size collapse to same name",
    cleanCashmeretteName("Montrose Top 12-32 printed pattern + free PDF") === cleanCashmeretteName("Montrose Top PDF pattern"),
  )
  // Chalk & Notch: PDF/printed collapse to same key
  check(
    "ChalkNotch: PDF/printed same key",
    cleanChalkNotchName("Fringe Dress + Top | PDF Pattern") === cleanChalkNotchName("Fringe Dress + Top - Printed Pattern"),
  )
}

async function main() {
  // Squarespace
  assertCatalogue("Aura Patterns", await crawl(auraPatternsAdapter), 30, 50)
  // Shopify (sequential)
  assertCatalogue("Birgitta Helmersson", await crawl(birgittaHelmerssonAdapter), 10, 30)
  assertCatalogue("Blank Slate", await crawl(blankSlatePatternsAdapter), 60, 100)
  assertCatalogue("By Hand London", await crawl(byHandLondonAdapter), 30, 60)
  assertCatalogue("Camimade", await crawl(camimadeAdapter), 8, 30)
  assertCatalogue("Cashmerette", await crawl(cashmeretteAdapter), 40, 130)
  assertCatalogue("Chalk and Notch", await crawl(chalkAndNotchAdapter), 25, 50)
  // Woo
  assertCatalogue("Bobbins and Buttons", await crawl(bobbinsAndButtonsAdapter), 10, 60)

  unitTests()

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
