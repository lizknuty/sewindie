import { matchyMatchyAdapter, cleanMatchyMatchyName } from "../app/lib/pattern-sync/adapters/matchy-matchy"
import { namedClothingAdapter, cleanNamedName } from "../app/lib/pattern-sync/adapters/named-clothing"
import { ninaLeeAdapter, cleanNinaLeeName } from "../app/lib/pattern-sync/adapters/nina-lee"
import { paperTheoryAdapter, cleanPaperTheoryName } from "../app/lib/pattern-sync/adapters/paper-theory"
import { papercutPatternsAdapter, cleanPapercutName } from "../app/lib/pattern-sync/adapters/papercut-patterns"
import { paradisePatternsAdapter, cleanParadiseName } from "../app/lib/pattern-sync/adapters/paradise-patterns"
import { madeForMermaidsAdapter, cleanMermaidsName } from "../app/lib/pattern-sync/adapters/made-for-mermaids"
import { ohhhLuluAdapter, cleanOhhhLuluName } from "../app/lib/pattern-sync/adapters/ohhh-lulu"
import type { DesignerAdapter, ScrapedPattern } from "../app/lib/pattern-sync/types"

const VALID_KINDS = new Set(["pattern", "bundle", "addon", "bonus", "other"])
let failures = 0
let checks = 0

function check(label: string, cond: boolean, detail = "") {
  checks++
  if (!cond) {
    failures++
    console.error(`  FAIL: ${label}${detail ? ` -- ${detail}` : ""}`)
  }
}

async function crawl(adapter: DesignerAdapter): Promise<ScrapedPattern[]> {
  return adapter.fetchCatalogue()
}

function assertCatalogue(label: string, items: ScrapedPattern[], min: number, max: number, imgFrac = 0.9) {
  console.log(`\n${label}: ${items.length} products`)
  check(`${label} count in [${min}, ${max}]`, items.length >= min && items.length <= max, `got ${items.length}`)
  check(`${label} all have names`, items.every((p) => p.name && p.name.length > 1))
  check(`${label} all have urls`, items.every((p) => p.url && p.url.startsWith("http")))
  check(`${label} all valid kinds`, items.every((p) => VALID_KINDS.has(p.kind)))
  const patterns = items.filter((p) => p.kind === "pattern").length
  check(`${label} majority are patterns`, patterns >= items.length * 0.5, `${patterns}/${items.length}`)
  const withImg = items.filter((p) => p.imageUrl).length
  check(`${label} >=${Math.round(imgFrac * 100)}% have images`, withImg >= items.length * imgFrac, `${withImg}/${items.length}`)
  const ids = new Set(items.map((p) => p.sourceId))
  check(`${label} sourceIds unique`, ids.size === items.length, `${ids.size} unique of ${items.length}`)
  console.log(`  sample: ${items.slice(0, 4).map((p) => `[${p.kind}] ${p.name}`).join(" | ")}`)
}

function runUnitTests() {
  console.log("\n=== Offline cleaner unit tests ===")
  check("MatchyMatchy strips FREE + tail", cleanMatchyMatchyName("FREE All Day Culottes PDF Sewing Pattern") === "All Day Culottes", cleanMatchyMatchyName("FREE All Day Culottes PDF Sewing Pattern"))
  check("Named keeps garment name", cleanNamedName("Aaria mini wrap dress") === "Aaria mini wrap dress", cleanNamedName("Aaria mini wrap dress"))
  check("NinaLee strips size tail", cleanNinaLeeName("Dolores – PDF sewing pattern (sizes 6–20)") === "Dolores", cleanNinaLeeName("Dolores – PDF sewing pattern (sizes 6–20)"))
  check("NinaLee twin cleans same", cleanNinaLeeName("Dolores – PDF sewing pattern (sizes 16–28)") === "Dolores", cleanNinaLeeName("Dolores – PDF sewing pattern (sizes 16–28)"))
  check("PaperTheory strips PDF Pattern", cleanPaperTheoryName("Olya Shirt PDF Pattern") === "Olya Shirt", cleanPaperTheoryName("Olya Shirt PDF Pattern"))
  check("Papercut strips trailing PDF", cleanPapercutName("Sigma Dress PDF") === "Sigma Dress", cleanPapercutName("Sigma Dress PDF"))
  check("Paradise strips FREE", cleanParadiseName("FREE Mid-Rise Rose Bottoms Expansion") === "Mid-Rise Rose Bottoms Expansion", cleanParadiseName("FREE Mid-Rise Rose Bottoms Expansion"))
  check("Mermaids normalizes freebie prefix", cleanMermaidsName("FREE PDF PATTERN- Fabric Basket in 2 sizes") === "Fabric Basket in 2 sizes", cleanMermaidsName("FREE PDF PATTERN- Fabric Basket in 2 sizes"))
  check("OhhhLulu keeps no-pattern-word name", cleanOhhhLuluName("The Cedar Bodysuit") === "The Cedar Bodysuit", cleanOhhhLuluName("The Cedar Bodysuit"))
  check("OhhhLulu strips PDF Sewing Pattern", cleanOhhhLuluName("Birch No Show Bikini Brief Panties PDF Sewing Pattern") === "Birch No Show Bikini Brief Panties", cleanOhhhLuluName("Birch No Show Bikini Brief Panties PDF Sewing Pattern"))
}

async function main() {
  runUnitTests()
  assertCatalogue("Matchy Matchy", await crawl(matchyMatchyAdapter), 30, 55)
  assertCatalogue("Named Clothing", await crawl(namedClothingAdapter), 75, 95)
  const ninaLee = await crawl(ninaLeeAdapter)
  assertCatalogue("Nina Lee", ninaLee, 18, 32)
  assertCatalogue("Paper Theory", await crawl(paperTheoryAdapter), 7, 15)
  assertCatalogue("Papercut", await crawl(papercutPatternsAdapter), 55, 75)
  assertCatalogue("Paradise Patterns", await crawl(paradisePatternsAdapter), 12, 26)
  assertCatalogue("Made for Mermaids", await crawl(madeForMermaidsAdapter), 500, 850, 0.8)
  assertCatalogue("Ohhh Lulu", await crawl(ohhhLuluAdapter), 40, 60, 0.8)

  // Nina Lee: size-range twins collapsed -> unique names.
  const nlNames = new Set(ninaLee.map((p) => p.name.toLowerCase()))
  check("Nina Lee names collapsed (no size twins)", nlNames.size === ninaLee.length, `${nlNames.size} of ${ninaLee.length}`)

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks passed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
