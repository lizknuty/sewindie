import { kdornbierDesignsAdapter, cleanKdornbierName } from "../app/lib/pattern-sync/adapters/kdornbier-designs"
import {
  littleRosyCheeksAdapter,
  lrcCollapseKey,
  cleanLrcName,
} from "../app/lib/pattern-sync/adapters/little-rosy-cheeks"
import { maisonFauveAdapter, fauveCollapseKey, cleanFauveName } from "../app/lib/pattern-sync/adapters/maison-fauve"
import { lenalinePatternsAdapter } from "../app/lib/pattern-sync/adapters/lenaline-patterns"
import { lesPerlinesAdapter, cleanLesPerlinesName } from "../app/lib/pattern-sync/adapters/les-perlines"
import { madeMyWardrobeAdapter, cleanMadeMyWardrobeName } from "../app/lib/pattern-sync/adapters/made-my-wardrobe"
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

function assertCatalogue(name: string, patterns: ScrapedPattern[], min: number, max: number) {
  console.log(`\n### ${name}: ${patterns.length} patterns`)
  check(`${name}: count in [${min}, ${max}]`, patterns.length >= min && patterns.length <= max, `got ${patterns.length}`)
  check(`${name}: all have non-empty name`, patterns.every((p) => p.name.trim().length > 0))
  check(`${name}: all have url`, patterns.every((p) => /^https?:\/\//.test(p.url)))
  const patternKind = patterns.filter((p) => p.kind === "pattern")
  check(`${name}: pattern-kind rows have image`, patternKind.every((p) => !!p.imageUrl), "some pattern missing image")
  check(`${name}: all have sourceId`, patterns.every((p) => !!p.sourceId))
  const urls = new Set(patterns.map((p) => p.url))
  check(`${name}: urls unique`, urls.size === patterns.length, `${patterns.length - urls.size} dupes`)
  const names = patterns.map((p) => p.name)
  console.log(`   sample: ${names.slice(0, 6).map((n) => `"${n}"`).join(", ")}`)
}

async function main() {
  // ---- Offline unit tests -------------------------------------------------
  console.log("\n=== UNIT: name cleaners / collapse keys ===")

  check(`Kdornbier: strip digital embroidery tail`, cleanKdornbierName("Cable Knit Socks Digital Embroidery Pattern") === "Cable Knit Socks")
  check(`Kdornbier: strip needle painting tail`, cleanKdornbierName("High Heel Digital Needle Painting Pattern") === "High Heel")
  check(`Kdornbier: clean sewing name untouched`, cleanKdornbierName("Avery Pencil Skirt") === "Avery Pencil Skirt")

  check(`LRC key: PDF/paper collapse to same key`, lrcCollapseKey("FOY Jumpsuit Adult's Pattern PDF") === lrcCollapseKey("FOY Jumpsuit Adult's Pattern"))
  check(`LRC key: order-independent`, lrcCollapseKey("FOLLY Jumpsuit pattern") === lrcCollapseKey("FOLLY Jumpsuit PDF"))
  check(`LRC key: adult vs kids stay distinct`, lrcCollapseKey("MAIZE Dress Adult's Pattern") !== lrcCollapseKey("MAIZE Dress Kids Pattern"))
  check(`LRC name: keeps CAPS + qualifier`, cleanLrcName("FOY Jumpsuit Adult's Pattern PDF") === "FOY Jumpsuit Adult's")

  check(`Fauve key: pdf==pochette same design`, fauveCollapseKey("Patron couture robe Rosalie / PDF (A4, A3, A0)") === fauveCollapseKey("Patron couture robe Rosalie - Patron pochette"))
  check(`Fauve key: distinct designs differ`, fauveCollapseKey("Patron couture robe Cuba Libre / PDF") !== fauveCollapseKey("Patron couture veste Nage Libre / PDF"))
  check(`Fauve name: strip prefix+tail, keep French`, cleanFauveName("Patron couture robe Pétula / PDF (A4, A3, A0, US Letter)") === "Robe Pétula")

  check(`LesPerlines: strip 'The' + format`, cleanLesPerlinesName("The Mesa Top – pdf pattern") === "Mesa Top")
  check(`LesPerlines: missing-space dash`, cleanLesPerlinesName("The Weekday Shirt– pdf pattern") === "Weekday Shirt")

  check(`MMW: strip PDF Version tail`, cleanMadeMyWardrobeName("Delilah Dress - PDF Version") === "Delilah Dress")
  check(`MMW: strip Printed Pattern tail`, cleanMadeMyWardrobeName("Delilah Dress - Printed Pattern") === "Delilah Dress")
  check(`MMW: PDF & Printed collapse to same name`, cleanMadeMyWardrobeName("Hilda Bag - PDF Version") === cleanMadeMyWardrobeName("Hilda Bag - Printed Version"))

  // ---- Live catalogues ----------------------------------------------------
  console.log("\n=== LIVE: catalogues ===")
  const [kd, lrc, mf, len, lp, mmw] = await Promise.all([
    kdornbierDesignsAdapter.fetchCatalogue(),
    littleRosyCheeksAdapter.fetchCatalogue(),
    maisonFauveAdapter.fetchCatalogue(),
    lenalinePatternsAdapter.fetchCatalogue(),
    lesPerlinesAdapter.fetchCatalogue(),
    madeMyWardrobeAdapter.fetchCatalogue(),
  ])

  assertCatalogue("Kdornbier Designs", kd, 18, 32)
  assertCatalogue("Little Rosy Cheeks", lrc, 9, 14)
  assertCatalogue("Maison Fauve", mf, 130, 150)
  assertCatalogue("Lenaline Patterns", len, 35, 48)
  assertCatalogue("Les Perlines", lp, 15, 20)
  assertCatalogue("Made My Wardrobe", mmw, 12, 18)

  // MMW & LRC: no format-descriptor leaked into a collapsed name.
  check("MMW: no '- Version' leak", !mmw.some((p) => /\bversion\b/i.test(p.name)))
  check("MMW: PDF/Printed collapsed (no dup names)", new Set(mmw.map((p) => p.name.toLowerCase())).size === mmw.length)
  check("LRC: no 'Children's Sewing' leak", !lrc.some((p) => /children['’]?s\s+sewing/i.test(p.name)))
  check("LRC: no dup names", new Set(lrc.map((p) => p.name.toLowerCase())).size === lrc.length)

  // Maison Fauve specifics: no complement rows survived, no 3+ key collisions.
  check("Maison Fauve: no 'complément' rows", !mf.some((p) => /compl[eé]ment/i.test(p.name)))
  // Les Perlines: English only (no French "Le/La/patron" style leaks).
  check("Les Perlines: English names only", !lp.some((p) => /\bpatron\b/i.test(p.name)))
  // Lenaline: no draft copies.
  check("Lenaline: no (Copy)/(Copie) rows", !len.some((p) => /\((?:copy|copie)\)/i.test(p.name)))

  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error("verify crashed:", err)
  process.exit(1)
})
