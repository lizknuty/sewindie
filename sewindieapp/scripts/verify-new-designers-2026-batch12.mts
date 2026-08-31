import { jenniferLaurenAdapter, cleanJenniferLaurenName } from "../app/lib/pattern-sync/adapters/jennifer-lauren"
import { jennuineDesignAdapter, cleanJennuineName } from "../app/lib/pattern-sync/adapters/jennuine-design"
import { madswickAdapter, cleanMadswickName } from "../app/lib/pattern-sync/adapters/madswick"
import { meganNielsenAdapter, cleanMeganNielsenName } from "../app/lib/pattern-sync/adapters/megan-nielsen"
import { melilotAdapter, cleanMelilotName } from "../app/lib/pattern-sync/adapters/melilot"
import { mimoiAdapter, cleanMimoiName } from "../app/lib/pattern-sync/adapters/mimoi"
import { lydiaNaomiAdapter, cleanLydiaNaomiName } from "../app/lib/pattern-sync/adapters/lydia-naomi"
import { howToDoFashionAdapter, cleanHowToDoFashionName } from "../app/lib/pattern-sync/adapters/how-to-do-fashion"
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
  const items = await adapter.fetchCatalogue()
  return items
}

function assertCatalogue(label: string, items: ScrapedPattern[], min: number, max: number) {
  console.log(`\n${label}: ${items.length} products`)
  check(`${label} count in [${min}, ${max}]`, items.length >= min && items.length <= max, `got ${items.length}`)
  check(`${label} all have names`, items.every((p) => p.name && p.name.length > 1))
  check(`${label} all have urls`, items.every((p) => p.url && p.url.startsWith("http")))
  check(`${label} all valid kinds`, items.every((p) => VALID_KINDS.has(p.kind)))
  const patterns = items.filter((p) => p.kind === "pattern").length
  check(`${label} majority are patterns`, patterns >= items.length * 0.5, `${patterns}/${items.length}`)
  const withImg = items.filter((p) => p.imageUrl).length
  check(`${label} >=90% have images`, withImg >= items.length * 0.9, `${withImg}/${items.length}`)
  const ids = new Set(items.map((p) => p.sourceId))
  check(`${label} sourceIds unique`, ids.size === items.length, `${ids.size} unique of ${items.length}`)
  console.log(`  sample: ${items.slice(0, 4).map((p) => `[${p.kind}] ${p.name}`).join(" | ")}`)
}

function runUnitTests() {
  console.log("\n=== Offline cleaner unit tests ===")
  check("JenniferLauren strips descriptor", cleanJenniferLaurenName("The Emmie Tee - PDF Sewing Pattern") === "The Emmie Tee", cleanJenniferLaurenName("The Emmie Tee - PDF Sewing Pattern"))
  check("Jennuine keeps Big & Little", cleanJennuineName("Big & Little Limone Lounge Set") === "Big & Little Limone Lounge Set", cleanJennuineName("Big & Little Limone Lounge Set"))
  check("Madswick strips | PDF", cleanMadswickName("Camille Chemise | PDF") === "Camille Chemise", cleanMadswickName("Camille Chemise | PDF"))
  check("MeganNielsen keeps Curve", cleanMeganNielsenName("Hovea Curve Jacket & Coat Pattern") === "Hovea Curve Jacket & Coat", cleanMeganNielsenName("Hovea Curve Jacket & Coat Pattern"))
  check("Melilot keeps simple name", cleanMelilotName("Akira") === "Akira", cleanMelilotName("Akira"))
  check("Mimoi strips pochette tail", cleanMimoiName("Savage, blouse - Patron pochette") === "Savage, blouse", cleanMimoiName("Savage, blouse - Patron pochette"))
  check("Mimoi strips PDF tail same as pochette", cleanMimoiName("Savage, blouse - Patron PDF") === "Savage, blouse", cleanMimoiName("Savage, blouse - Patron PDF"))
  check("LydiaNaomi strips PDF pattern", cleanLydiaNaomiName("Cool Skirt PDF Sewing Pattern") === "Cool Skirt", cleanLydiaNaomiName("Cool Skirt PDF Sewing Pattern"))
  check("HowToDoFashion strips PDF size tail", cleanHowToDoFashionName("No. 34 San Marino - PDF Size 32-54") === "No. 34 San Marino", cleanHowToDoFashionName("No. 34 San Marino - PDF Size 32-54"))
  check("HowToDoFashion printed twin cleans same", cleanHowToDoFashionName("No. 34 San Marino - Printed - Size 32-54") === "No. 34 San Marino", cleanHowToDoFashionName("No. 34 San Marino - Printed - Size 32-54"))
}

async function main() {
  runUnitTests()
  assertCatalogue("Jennifer Lauren", await crawl(jenniferLaurenAdapter), 35, 65)
  assertCatalogue("Jennuine Design", await crawl(jennuineDesignAdapter), 60, 100)
  assertCatalogue("Madswick", await crawl(madswickAdapter), 15, 35)
  assertCatalogue("Megan Nielsen", await crawl(meganNielsenAdapter), 60, 110)
  assertCatalogue("Melilot", await crawl(melilotAdapter), 35, 60)
  assertCatalogue("Mimoï", await crawl(mimoiAdapter), 50, 70)
  assertCatalogue("Lydia Naomi", await crawl(lydiaNaomiAdapter), 20, 40)
  assertCatalogue("How to Do Fashion", await crawl(howToDoFashionAdapter), 30, 55)

  // Mimoï: no format twins should survive (unique names).
  const mimoi = await crawl(mimoiAdapter)
  const mimoiNames = new Set(mimoi.map((p) => p.name.toLowerCase()))
  check("Mimoï names collapsed (no dup twins)", mimoiNames.size === mimoi.length, `${mimoiNames.size} of ${mimoi.length}`)

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${checks - failures}/${checks} checks passed`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
