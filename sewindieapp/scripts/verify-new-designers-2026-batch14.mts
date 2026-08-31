import { patternSewcietyAdapter, cleanPatternSewcietyName } from "../app/lib/pattern-sync/adapters/pattern-sewciety"
import { peppermintAdapter, cleanPeppermintName } from "../app/lib/pattern-sync/adapters/peppermint"
import { mavenPatternsAdapter, cleanMavenName } from "../app/lib/pattern-sync/adapters/maven-patterns"
import { julianaMartejevsAdapter, cleanJulianaName } from "../app/lib/pattern-sync/adapters/juliana-martejevs"
import { orageuseAdapter, cleanOrageuseName } from "../app/lib/pattern-sync/adapters/orageuse"
import { sewLiberatedAdapter, cleanSewLiberatedName } from "../app/lib/pattern-sync/adapters/sew-liberated"
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
  check(
    `${label} >=${Math.round(imgFrac * 100)}% have images`,
    withImg >= items.length * imgFrac,
    `${withImg}/${items.length}`,
  )
  const ids = new Set(items.map((p) => p.sourceId))
  check(`${label} sourceIds unique`, ids.size === items.length, `${ids.size} unique of ${items.length}`)
  console.log(`  sample: ${items.slice(0, 5).map((p) => `[${p.kind}] ${p.name}`).join(" | ")}`)
}

function runUnitTests() {
  console.log("\n=== Offline cleaner unit tests ===")
  check(
    "PatternSewciety strips PDF tail",
    cleanPatternSewcietyName("Aria Dress - PDF Sewing Pattern") === "Aria Dress",
    cleanPatternSewcietyName("Aria Dress - PDF Sewing Pattern"),
  )
  check(
    "Peppermint strips Sewing School suffix + brand",
    cleanPeppermintName("Peppermint Wrap Top - Sewing School") === "Wrap Top",
    cleanPeppermintName("Peppermint Wrap Top - Sewing School"),
  )
  check(
    "Maven strips 'the' + PDF tail",
    cleanMavenName("The Warwick Tie - PDF Sewing Pattern") === "Warwick Tie",
    cleanMavenName("The Warwick Tie - PDF Sewing Pattern"),
  )
  check(
    "Juliana strips Schnittmuster descriptor",
    cleanJulianaName("Kleid Frida - Schnittmuster & Nähanleitung") === "Kleid Frida",
    cleanJulianaName("Kleid Frida - Schnittmuster & Nähanleitung"),
  )
  check(
    "Orageuse decodes entity + strips DIY prefix",
    cleanOrageuseName("DIY &#8211; étole multi-positions Oslo") === "étole multi-positions Oslo",
    cleanOrageuseName("DIY &#8211; étole multi-positions Oslo"),
  )
  check(
    "SewLiberated strips trailing Pattern",
    cleanSewLiberatedName("Madrone Pants Pattern") === "Madrone Pants",
    cleanSewLiberatedName("Madrone Pants Pattern"),
  )
}

async function main() {
  runUnitTests()

  assertCatalogue("Pattern Sewciety", await crawl(patternSewcietyAdapter), 10, 22)
  assertCatalogue("Peppermint", await crawl(peppermintAdapter), 20, 70, 0.6)
  assertCatalogue("Maven Patterns", await crawl(mavenPatternsAdapter), 30, 70)
  assertCatalogue("Juliana Martejevs", await crawl(julianaMartejevsAdapter), 80, 130)
  assertCatalogue("Orageuse", await crawl(orageuseAdapter), 12, 22, 0.8)
  const sewLib = await crawl(sewLiberatedAdapter)
  assertCatalogue("Sew Liberated", sewLib, 40, 75, 0.8)

  // Sew Liberated: courses must NOT leak in as patterns.
  check(
    "Sew Liberated excludes courses",
    !sewLib.some((p) => /learn to sew|\bcourse\b/i.test(p.name)),
    sewLib.filter((p) => /learn to sew|\bcourse\b/i.test(p.name)).map((p) => p.name).join(", "),
  )

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks passed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
