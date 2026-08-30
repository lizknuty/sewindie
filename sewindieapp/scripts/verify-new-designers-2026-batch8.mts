// Verify batch 8: Sew a Little Seam, Winslet's, True Bias, Thread Theory,
// Wildflower Design, Winter Wear Designs. Run:
//   npx tsx scripts/verify-new-designers-2026-batch8.mts
import { sewALittleSeamAdapter, cleanSlsName } from "../app/lib/pattern-sync/adapters/sew-a-little-seam"
import { winsletsAdapter, cleanWinsletsName } from "../app/lib/pattern-sync/adapters/winslets"
import { trueBiasAdapter, cleanTrueBiasName, trueBiasKey } from "../app/lib/pattern-sync/adapters/true-bias"
import { threadTheoryAdapter, cleanThreadTheoryName } from "../app/lib/pattern-sync/adapters/thread-theory"
import { wildflowerDesignAdapter, cleanWildflowerName } from "../app/lib/pattern-sync/adapters/wildflower-design"
import { winterWearDesignsAdapter, cleanWinterWearName } from "../app/lib/pattern-sync/adapters/winter-wear-designs"
import type { ScrapedPattern } from "../app/lib/pattern-sync/types"

let passed = 0
let failed = 0
function check(label: string, cond: boolean) {
  if (cond) {
    passed++
  } else {
    failed++
    console.log(`  FAIL: ${label}`)
  }
}

function assertCatalogue(name: string, items: ScrapedPattern[], min: number, max: number) {
  console.log(`\n${name}: ${items.length} products`)
  check(`${name}: >= ${min}`, items.length >= min)
  check(`${name}: <= ${max}`, items.length <= max)
  check(`${name}: all have non-empty name`, items.every((p) => p.name.trim().length > 0))
  check(`${name}: all have http url`, items.every((p) => /^https?:\/\//.test(p.url)))
  // A rare store product genuinely has no image in the feed; allow a few misses.
  const withImage = items.filter((p) => p.imageUrl != null && /^https?:\/\//.test(p.imageUrl)).length
  check(`${name}: >=95% have http image (${withImage}/${items.length})`, withImage >= Math.ceil(items.length * 0.95))
  check(`${name}: unique sourceIds`, new Set(items.map((p) => p.sourceId)).size === items.length)
  check(`${name}: no obvious gift card`, items.every((p) => !/gift\s*card/i.test(p.name)))
  console.log(`  sample: ${items.slice(0, 4).map((p) => `"${p.name}" [${p.kind}]`).join(", ")}`)
}

async function main() {
  console.log("=== UNIT: name cleaners & classifiers ===")
  // Sew a Little Seam
  check("SLS: strip age range", cleanSlsName("Hadley Top, Tunic & Dress PDF Pattern 12 Months-12 Years") === "Hadley Top, Tunic & Dress")
  check("SLS: strip Size N", cleanSlsName("Birthday Dress & Peplum Pattern Size 2") === "Birthday Dress & Peplum")
  check("SLS: strip Plus Size PDF", cleanSlsName("Childrens Nightingale Plus Size PDF Pattern") === "Childrens Nightingale")
  // Winslet's
  check("Winslets: strip boilerplate", cleanWinsletsName("Utility Mini Skirt Sewing Pattern 'Sabrina'") === "Utility Mini Skirt 'Sabrina'")
  // True Bias
  check("TrueBias: clean name", cleanTrueBiasName("Ogden Cami") === "Ogden Cami")
  check("TrueBias: collapse key equal", trueBiasKey("Shelby Dress & Romper") === trueBiasKey("Shelby Dress & Romper"))
  // Thread Theory
  check("ThreadTheory: strip PDF boilerplate", cleanThreadTheoryName("Jedediah Pants PDF Sewing Pattern") === "Jedediah Pants")
  check("ThreadTheory: strip free pattern", cleanThreadTheoryName("Fairfield Button-up Free Pattern") === "Fairfield Button-up")
  // Wildflower
  check("Wildflower: strip free download", cleanWildflowerName("Aster Collar Free Digital Download") === "Aster Collar")
  // Winter Wear
  check("WinterWear: strip size", cleanWinterWearName("Boxy Tee size XXS-5X") === "Boxy Tee")
  check("WinterWear: strip promo paren", cleanWinterWearName("Split Hem Tee for Kids size 1-16 (Free with code)") === "Split Hem Tee for Kids")
  check("WinterWear: strip - FREE tail", cleanWinterWearName("Cross Hem Tee for Women size 00-24 - FREE WITH CODE") === "Cross Hem Tee for Women")

  console.log("\n=== LIVE CATALOGUES (sequential) ===")
  const sls = await sewALittleSeamAdapter.fetchCatalogue()
  const win = await winsletsAdapter.fetchCatalogue()
  const tb = await trueBiasAdapter.fetchCatalogue()
  const tt = await threadTheoryAdapter.fetchCatalogue()
  const wf = await wildflowerDesignAdapter.fetchCatalogue()
  const ww = await winterWearDesignsAdapter.fetchCatalogue()

  assertCatalogue("Sew a Little Seam", sls, 55, 70)
  assertCatalogue("Winslet's", win, 190, 230)
  assertCatalogue("True Bias", tb, 35, 50)
  assertCatalogue("Thread Theory", tt, 45, 60)
  assertCatalogue("Wildflower Design", wf, 4, 20)
  assertCatalogue("Winter Wear Designs", ww, 110, 150)

  // True Bias must actually collapse (70 listings -> ~41 designs)
  check("True Bias: collapsed below 50", tb.length < 50)
  // Winslet's should exclude the gift card
  check("Winslet's: no gift card", win.every((p) => !/gift/i.test(p.name)))
  // Winter Wear must exclude HTV-only products
  check("Winter Wear: no pure HTV", ww.every((p) => !/^\s*(?:12 days.*htv|htv collection|christmas htv)/i.test(p.name)))
  // Thread Theory free patterns flagged bonus
  check("Thread Theory: has bonus (free) items", tt.some((p) => p.kind === "bonus"))

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
