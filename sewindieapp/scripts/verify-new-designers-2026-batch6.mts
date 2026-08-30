import { patternFantastiqueAdapter } from "../app/lib/pattern-sync/adapters/pattern-fantastique"
import { patternPaperScissorsAdapter, cleanPpsName } from "../app/lib/pattern-sync/adapters/pattern-paper-scissors"
import { patternScoutStudioAdapter } from "../app/lib/pattern-sync/adapters/pattern-scout-studio"
import { petiteStitcheryAdapter } from "../app/lib/pattern-sync/adapters/petite-stitchery"
import { puffAndPencilAdapter, puffCollapseKey, cleanPuffName } from "../app/lib/pattern-sync/adapters/puff-and-pencil"
import { patternNicheAdapter } from "../app/lib/pattern-sync/adapters/pattern-niche"
import { primroseDawnAdapter, cleanPrimroseName } from "../app/lib/pattern-sync/adapters/primrose-dawn"
import { patternUnionAdapter } from "../app/lib/pattern-sync/adapters/pattern-union"
import { paulineAliceAdapter, cleanPaulineName } from "../app/lib/pattern-sync/adapters/pauline-alice"
import type { ScrapedPattern } from "../app/lib/pattern-sync/types"

let pass = 0
let fail = 0
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++
    console.log(`  ok   ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}${detail ? ` -- ${detail}` : ""}`)
  }
}

function assertCatalogue(
  name: string,
  patterns: ScrapedPattern[],
  min: number,
  max: number,
  opts: { requireImage?: boolean } = {},
) {
  const { requireImage = true } = opts
  console.log(`\n### ${name}: ${patterns.length} patterns`)
  check(`${name}: count in [${min}, ${max}]`, patterns.length >= min && patterns.length <= max, `got ${patterns.length}`)
  check(`${name}: all have non-empty name`, patterns.every((p) => p.name.trim().length > 0))
  check(`${name}: all have url`, patterns.every((p) => /^https?:\/\//.test(p.url)))
  if (requireImage) {
    const patternKind = patterns.filter((p) => p.kind === "pattern")
    check(`${name}: pattern-kind rows have image`, patternKind.every((p) => !!p.imageUrl), "some pattern missing image")
  }
  check(`${name}: all have sourceId`, patterns.every((p) => !!p.sourceId))
  const urls = new Set(patterns.map((p) => p.url))
  check(`${name}: urls unique`, urls.size === patterns.length, `${patterns.length - urls.size} dupes`)
  const names = new Set(patterns.map((p) => p.name.toLowerCase()))
  check(`${name}: names unique`, names.size === patterns.length, `${patterns.length - names.size} dup names`)
  console.log(`   sample: ${patterns.slice(0, 6).map((p) => `"${p.name}"`).join(", ")}`)
}

async function main() {
  // ---- Offline unit tests -------------------------------------------------
  console.log("### Unit tests: name cleaners / collapse keys")

  // Pattern Paper Scissors: strip descriptor + size/format tails.
  check(`PPS: strip sewing pattern + size tail`, cleanPpsName("Girls Jersey Smock Dress - Sewing Pattern, Sizes 2-11 yrs, PDF Option") === "Girls Jersey Smock Dress")
  check(`PPS: drop FREE prefix`, cleanPpsName("FREE Billy Bandana Bib Pattern") === "Billy Bandana Bib")
  check(`PPS: strip trailing Pattern`, cleanPpsName("Christmas Stocking Pattern") === "Christmas Stocking")

  // Puff and Pencil: collapse (PDF)/(PAPER); key ignores format token.
  check(`Puff: strip (PDF)`, cleanPuffName("SLASH DRESS (PDF)") === "SLASH DRESS")
  check(`Puff: PDF & PAPER share key`, puffCollapseKey("SLASH DRESS (PDF)") === puffCollapseKey("SLASH DRESS (PAPER)"))

  // Primrose Dawn: cut ": description" + "PDF sewing pattern".
  check(`Primrose: cut colon desc`, cleanPrimroseName("Chiara Bralette PDF sewing pattern: wireless soft cup bra") === "Chiara Bralette")
  check(`Primrose: keep pillow`, cleanPrimroseName("Solace Mastectomy Pillow PDF sewing pattern: Post-surgery") === "Solace Mastectomy Pillow")

  // Pauline Alice: strip "(stockists)" suffix.
  check(`Pauline: strip (stockists)`, cleanPaulineName("Mila Jumpsuit (stockists)") === "Mila Jumpsuit")
  check(`Pauline: clean name untouched`, cleanPaulineName("Cami Dress") === "Cami Dress")

  // ---- Live catalogue crawls ---------------------------------------------
  const [pf, pps, pss, ps, puff, pn, pd, pu, pa] = await Promise.all([
    patternFantastiqueAdapter.fetchCatalogue(),
    patternPaperScissorsAdapter.fetchCatalogue(),
    patternScoutStudioAdapter.fetchCatalogue(),
    petiteStitcheryAdapter.fetchCatalogue(),
    puffAndPencilAdapter.fetchCatalogue(),
    patternNicheAdapter.fetchCatalogue(),
    primroseDawnAdapter.fetchCatalogue(),
    patternUnionAdapter.fetchCatalogue(),
    paulineAliceAdapter.fetchCatalogue(),
  ])

  assertCatalogue("Pattern Fantastique", pf, 8, 25)
  assertCatalogue("Pattern Paper Scissors", pps, 20, 35)
  assertCatalogue("Pattern Scout Studio", pss, 8, 40)
  assertCatalogue("Petite Stitchery", ps, 400, 560)
  assertCatalogue("Puff and Pencil", puff, 70, 130)
  // Woo Store API here has no date_created and permalinks carry images.
  assertCatalogue("Pattern Niche", pn, 90, 170)
  assertCatalogue("Primrose Dawn", pd, 25, 45)
  // Scraped platforms: image comes from og/JSON-LD, should still be present.
  assertCatalogue("Pattern Union", pu, 10, 25)
  assertCatalogue("Pauline Alice", pa, 40, 80)

  // Leak checks on the trickier cleaners.
  check("PPS: no ', Sizes' leak", !pps.some((p) => /,\s*sizes/i.test(p.name)))
  check("Puff: no (PDF)/(PAPER) leak", !puff.some((p) => /\((pdf|paper)\)/i.test(p.name)))
  // Standalone modular add-ons are excluded by product_type; a bare "X SLEEVE" /
  // "X COLLAR" name with no garment word would signal a leaked add-on. Collab
  // names ("ZIP VEST X TWO PIECE SLEEVE") legitimately contain "sleeve".
  check(
    "Puff: no bare Sleeve/Collar add-ons",
    !puff.some((p) => /^[A-Z ]+\b(sleeve|collar)$/i.test(p.name) && !/\bx\b/i.test(p.name)),
  )
  check("Primrose: no ':' leak", !pd.some((p) => p.name.includes(":")))
  check("Pauline: no (stockists) leak", !pa.some((p) => /stockist/i.test(p.name)))
  check("Pattern Niche: no cut files / gift cards", !pn.some((p) => /cut file|gift card/i.test(p.name)))

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
