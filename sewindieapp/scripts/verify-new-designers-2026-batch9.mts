// Verify batch 9 designer adapters: live catalogue crawls (run SEQUENTIALLY to
// avoid hammering hosts) + offline unit tests of the name cleaners.
//
//   npx tsx scripts/verify-new-designers-2026-batch9.mts

import { aliceAndCoAdapter } from "../app/lib/pattern-sync/adapters/alice-and-co"
import { allieOlsonAdapter } from "../app/lib/pattern-sync/adapters/allie-olson"
import { annaAllenAdapter, cleanAnnaAllenName } from "../app/lib/pattern-sync/adapters/anna-allen"
import { bellaLovesPatternsAdapter, cleanBellaLovesName } from "../app/lib/pattern-sync/adapters/bella-loves-patterns"
import { alinaDesignCoAdapter } from "../app/lib/pattern-sync/adapters/alina-design-co"
import { amyNicoleStudioAdapter, cleanAmyNicoleName } from "../app/lib/pattern-sync/adapters/amy-nicole-studio"
import { anneKerdilesAdapter } from "../app/lib/pattern-sync/adapters/anne-kerdiles"
import { belowTheKowhaiAdapter } from "../app/lib/pattern-sync/adapters/below-the-kowhai"
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
  check(`${name}: valid kinds`, items.every((p) => ["pattern", "bundle", "addon"].includes(p.kind)))
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
  // Anna Allen
  check("AnnaAllen: strip PDF tail", cleanAnnaAllenName("Anthea Blouse + Dress - PDF Sewing Pattern Sizes 0-30") === "Anthea Blouse + Dress")
  check("AnnaAllen: expansion kept", cleanAnnaAllenName("Zipper Expansion - PDF Sewing Instructions") === "Zipper Expansion")
  // Bella Loves
  check("BellaLoves: strip PDF SEWING PATTERN", cleanBellaLovesName("RUPERT DOUBLE-FACED COAT – PDF SEWING PATTERN") === "RUPERT DOUBLE-FACED COAT")
  check("BellaLoves: collapse double space", cleanBellaLovesName("NETA TROUSERS  – PDF SEWING PATTERN") === "NETA TROUSERS")
  // Amy Nicole
  check("AmyNicole: strip PDF Pattern", cleanAmyNicoleName("Colleen Cape Dress &#038; Top PDF Pattern") === "Colleen Cape Dress & Top")
  check("AmyNicole: strip PDF Expansion", cleanAmyNicoleName("Audie Playdress PDF Expansion (Skirts Only!)") === "Audie Playdress (Skirts Only!)")
}

async function main() {
  // Shopify (sequential)
  assertCatalogue("Alice + Co", await crawl(aliceAndCoAdapter), 18, 34)
  assertCatalogue("Allie Olson", await crawl(allieOlsonAdapter), 8, 16)
  assertCatalogue("Anna Allen", await crawl(annaAllenAdapter), 8, 16)
  assertCatalogue("Bella Loves", await crawl(bellaLovesPatternsAdapter), 18, 34)
  // Woo (sequential)
  assertCatalogue("Alina Design Co", await crawl(alinaDesignCoAdapter), 6, 16)
  assertCatalogue("Amy Nicole Studio", await crawl(amyNicoleStudioAdapter), 6, 16)
  assertCatalogue("Anne Kerdiles", await crawl(anneKerdilesAdapter), 25, 48)
  assertCatalogue("Below the Kōwhai", await crawl(belowTheKowhaiAdapter), 22, 40)

  unitTests()

  console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
