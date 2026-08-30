// Verify batch 7 (Sew House Seven, Pattern Emporium, Sew DIY, Charlotte Emma,
// Sew Different, Ready to Sew, Rose Caldwell). Live crawls + offline unit tests.
//
// Run: npx tsx scripts/verify-new-designers-2026-batch7.mts

import { sewHouseSevenAdapter, cleanSewHouseSevenName, sewHouseSevenKey } from "../app/lib/pattern-sync/adapters/sew-house-seven"
import { patternEmporiumAdapter, cleanPatternEmporiumName } from "../app/lib/pattern-sync/adapters/pattern-emporium"
import { sewDiyAdapter, cleanSewDiyName } from "../app/lib/pattern-sync/adapters/sew-diy"
import { charlotteEmmaAdapter } from "../app/lib/pattern-sync/adapters/charlotte-emma"
import { sewDifferentAdapter } from "../app/lib/pattern-sync/adapters/sew-different"
import { readyToSewAdapter, cleanReadyToSewName } from "../app/lib/pattern-sync/adapters/ready-to-sew"
import { roseCaldwellAdapter, isRosePattern } from "../app/lib/pattern-sync/adapters/rose-caldwell"
import type { ScrapedPattern } from "../app/lib/pattern-sync/types"

let passed = 0
let failed = 0
function check(label: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ FAIL: ${label}`)
  }
}

function assertCatalogue(name: string, patterns: ScrapedPattern[], min: number, max: number) {
  console.log(`\n### ${name}: ${patterns.length} patterns`)
  console.log("  sample:", patterns.slice(0, 6).map((p) => p.name).join(" | "))
  check(`${name}: count in [${min}, ${max}]`, patterns.length >= min && patterns.length <= max)
  check(`${name}: all have name`, patterns.every((p) => p.name.trim().length > 0))
  check(`${name}: all have url`, patterns.every((p) => /^https?:\/\//.test(p.url)))
  check(`${name}: all have image`, patterns.every((p) => p.imageUrl && /^https?:\/\//.test(p.imageUrl)))
  check(`${name}: unique sourceIds`, new Set(patterns.map((p) => p.sourceId)).size === patterns.length)
}

async function main() {
  console.log("=== OFFLINE UNIT TESTS ===")
  // Sew House Seven collapse
  check("SHS: strip (PDF) tail", cleanSewHouseSevenName("Revel Topper Sewing Pattern (PDF)") === "Revel Topper")
  check("SHS: strip (Printed) tail", cleanSewHouseSevenName("Revel Topper Sewing Pattern (Printed)") === "Revel Topper")
  check("SHS: strip CURVY FIT", cleanSewHouseSevenName("Revel Topper CURVY FIT Sewing Pattern (PDF)") === "Revel Topper")
  check("SHS: three variants share a key",
    sewHouseSevenKey("Revel Topper Sewing Pattern (PDF)") === sewHouseSevenKey("Revel Topper CURVY FIT Sewing Pattern (Printed)"))
  // Pattern Emporium
  check("PE: name before pipe", cleanPatternEmporiumName("Just Between Us | Woven Top PDF Sewing Pattern") === "Just Between Us")
  check("PE: strip tail w/o pipe", cleanPatternEmporiumName("Refresh Ruched T-shirt PDF Sewing Pattern") === "Refresh Ruched T-shirt")
  // Sew DIY
  check("SewDIY: strip PDF Sewing Pattern", cleanSewDiyName("Eva Tops and Sundress PDF Sewing Pattern") === "Eva Tops and Sundress")
  check("SewDIY: strip PDF Pattern", cleanSewDiyName("Lela Skirt PDF Pattern") === "Lela Skirt")
  // Ready to Sew
  check("RTS: cut store suffix + clause",
    cleanReadyToSewName("Jean-Paul Boilersuit - Workwear Sewing Pattern, Sizes 0 to 20 | Ready to Sew") === "Jean-Paul Boilersuit")
  check("RTS: keep hyphenated first name", cleanReadyToSewName("Jean-Paul Boilersuit | Ready to Sew") === "Jean-Paul Boilersuit")
  // Rose Caldwell classifier
  check("Rose: PDF pattern kept", isRosePattern("Willa Dress PDF Pattern", "The Willa dress is a digital PDF sewing pattern.") === true)
  check("Rose: free template kept", isRosePattern("Garland Shape Template", "This is a free digital PDF download.") === true)
  check("Rose: bundle kept", isRosePattern("The Carry All Pattern Bundle", "3 PDF PATTERNS included.") === true)
  check("Rose: handmade blouse excluded", isRosePattern("The Emma Blouse - Coral", "lovingly handmade using vintage Laura Ashley cotton") === false)
  check("Rose: cushion excluded", isRosePattern("Quilted Bolster Cushion Cover", "Handmade quilted cushion cover with ruffle") === false)
  check("Rose: licence excluded", isRosePattern("Commercial Use Licence for one sewing pattern", "licence to sell finished items") === false)

  console.log("\n=== LIVE CATALOGUES ===")
  const [shs, pe, sewdiy, ce, sd, rts, rose] = await Promise.all([
    sewHouseSevenAdapter.fetchCatalogue(),
    patternEmporiumAdapter.fetchCatalogue(),
    sewDiyAdapter.fetchCatalogue(),
    charlotteEmmaAdapter.fetchCatalogue(),
    sewDifferentAdapter.fetchCatalogue(),
    readyToSewAdapter.fetchCatalogue(),
    roseCaldwellAdapter.fetchCatalogue(),
  ])

  assertCatalogue("Sew House Seven", shs, 30, 45)
  check("SHS: no (PDF)/(Printed) leak", !shs.some((p) => /\((pdf|printed|paper)\)/i.test(p.name)))
  check("SHS: no CURVY FIT leak", !shs.some((p) => /curvy fit/i.test(p.name)))
  check("SHS: no wholesale", !shs.some((p) => /wholesale/i.test(p.name)))

  assertCatalogue("Pattern Emporium", pe, 125, 140)
  check("PE: no gift card", !pe.some((p) => /gift card/i.test(p.name)))
  check("PE: no pipe leak", !pe.some((p) => p.name.includes("|")))

  assertCatalogue("Sew DIY", sewdiy, 30, 50)
  check("SewDIY: no PDF Pattern leak", !sewdiy.some((p) => /pdf (sewing )?pattern/i.test(p.name)))

  assertCatalogue("Charlotte Emma Patterns", ce, 4, 12)
  assertCatalogue("Sew Different", sd, 60, 100)
  check("SewDiff: no fabric-only leak", !sd.some((p) => /cotton poplin|100% linen|100% cotton$/i.test(p.name)))

  assertCatalogue("Ready to Sew", rts, 30, 60)
  check("RTS: no store-suffix leak", !rts.some((p) => /\| ready to sew/i.test(p.name)))

  assertCatalogue("Rose Caldwell", rose, 15, 26)
  check("Rose: no vintage fabric leak", !rose.some((p) => /vintage|curtains|herringbone wool/i.test(p.name)))
  check("Rose: no licence leak", !rose.some((p) => /licen[cs]e/i.test(p.name)))

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
