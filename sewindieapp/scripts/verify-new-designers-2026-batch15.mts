import { ikateeAdapter, cleanIkateeName } from "../app/lib/pattern-sync/adapters/ikatee"
import { angelaKaneAdapter, cleanAngelaKaneName } from "../app/lib/pattern-sync/adapters/angela-kane"
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
  // No format-twin duplicates left in the display name.
  const names = new Set(items.map((p) => p.name.toLowerCase()))
  check(`${label} names unique`, names.size === items.length, `${names.size} unique of ${items.length}`)
  console.log(`  sample: ${items.slice(0, 6).map((p) => `[${p.kind}] ${p.name}`).join(" | ")}`)
}

function runUnitTests() {
  console.log("\n=== Offline cleaner unit tests ===")
  // Ikatee: strip leading "Patron", trailing format word, and separator tail.
  check(
    "Ikatee strips leading Patron + trailing PDF",
    cleanIkateeName("Patron robe SATURNE PDF") === "robe SATURNE",
    cleanIkateeName("Patron robe SATURNE PDF"),
  )
  check(
    "Ikatee strips pochette tail after separator",
    cleanIkateeName("Patron de couture veste OSAKA - pochette") === "veste OSAKA",
    cleanIkateeName("Patron de couture veste OSAKA - pochette"),
  )
  // Angela Kane: strip leading number + trailing "PDF Sewing Pattern", decode <br>.
  check(
    "AngelaKane strips PDF Sewing Pattern tail",
    cleanAngelaKaneName("Raglan Sleeve Jacket PDF Sewing Pattern") === "Raglan Sleeve Jacket",
    cleanAngelaKaneName("Raglan Sleeve Jacket PDF Sewing Pattern"),
  )
  check(
    "AngelaKane handles <br> + leading number",
    cleanAngelaKaneName("976 Harem Pants<br>PDF Sewing Pattern") === "Harem Pants",
    cleanAngelaKaneName("976 Harem Pants<br>PDF Sewing Pattern"),
  )
}

async function main() {
  runUnitTests()

  const ikatee = await crawl(ikateeAdapter)
  assertCatalogue("Ikatee", ikatee, 140, 220, 0.9)
  // Ikatee: fabric/notions must not leak in.
  check(
    "Ikatee excludes fabric/notions",
    !ikatee.some((p) => /\b(tissu|coupon|bouton|fil de|élastique|zip)\b/i.test(p.name)),
    ikatee.filter((p) => /\b(tissu|coupon|bouton|fil de|élastique|zip)\b/i.test(p.name)).map((p) => p.name).slice(0, 5).join(", "),
  )

  const angelaKane = await crawl(angelaKaneAdapter)
  // ~39 live pattern pages; a few sitemap entries are stale 404s (skipped).
  assertCatalogue("Angela Kane", angelaKane, 30, 50, 0.85)

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks passed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
