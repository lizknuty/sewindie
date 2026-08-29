// End-to-end check of the I AM Patterns adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-i-am-patterns-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { toTitleCase, classify } from "../app/lib/pattern-sync/adapters/i-am-patterns.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- title casing ----------------------------------------------------------
// The store shouts in ALL CAPS with en-dash separators; the catalogue holds
// naive every-word Title Case with hyphen separators. toTitleCase bridges the
// two and is the one place this adapter deviates from verbatim titles, so it
// carries the most risk. Expected values are the catalogue's OWN convention:
// every word capitalised (incl. "for", "and", and the acronym "PDF" -> "Pdf"),
// en-dash folded to hyphen. See adapter header note 3.
console.log("=== toTitleCase ===")
const titleCases: [string, string][] = [
  ["ANGEL", "Angel"],
  ["APOLLON – Women", "Apollon - Women"], // en-dash folds to hyphen
  ["ARTEMIS – Men", "Artemis - Men"],
  ["Duo PDF – DIAMOND & CRYSTAL", "Duo Pdf - Diamond & Crystal"], // PDF -> Pdf, & kept
  ["I AM ICONIC – 5 PDF Patterns – Complete collection", "I Am Iconic - 5 Pdf Patterns - Complete Collection"],
  ["MAGE & MIRA – Bundle 2 PDFs", "Mage & Mira - Bundle 2 Pdfs"],
  ["2 FOR 1 PDF – ZEBRE AND LION", "2 For 1 Pdf - Zebre And Lion"], // every word capitalised
]
for (const [input, expected] of titleCases) {
  const got = toTitleCase(input)
  ok(`"${input}" -> "${expected}"`, got === expected, got === expected ? "" : `got "${got}"`)
}
ok("no en-dash survives title-casing", !titleCases.some(([i]) => /[\u2013\u2014]/.test(toTitleCase(i))))
ok("matches the catalogue's naive convention (I AM -> I Am)", toTitleCase("I AM POWERFUL") === "I Am Powerful")

// --- classify --------------------------------------------------------------
console.log("\n=== classify ===")
ok("'... Bundle 2 PDFs' is a bundle", classify("MAGE & MIRA – Bundle 2 PDFs") === "bundle")
ok("'Duo PDF – ...' is a bundle", classify("Duo PDF – DIAMOND & CRYSTAL") === "bundle")
ok("'... 5 PDF Patterns ...' is a bundle", classify("I AM ICONIC – 5 PDF Patterns – Complete collection") === "bundle")
ok("a plain single pattern is not a bundle", classify("ANGEL") === "pattern")

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "I AM", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "i-am-patterns", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("i-am-patterns") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("i-am-patterns")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 155-185 band", scraped.length >= 155 && scraped.length <= 185, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("no name is ALL-CAPS (title-casing applied to all)", !scraped.some((p) => /[A-Z]{2,}/.test(p.name) && p.name === p.name.toUpperCase()))
ok("no en-dash in any name", !scraped.some((p) => /[\u2013\u2014]/.test(p.name)))
ok("every URL is the /en/product/ shape", scraped.every((p) => /^https:\/\/iampatterns\.fr\/en\/product\/[^/]+$/.test(p.url)))
// One product (CHERIE-CHERIE, featured_media 1678) has no retrievable embedded
// image, so imageUrl is null there -- valid per the schema. Assert near-total
// coverage and that any present URL is a real https URL.
const withImage = scraped.filter((p) => (p.imageUrl ?? "").startsWith("https://"))
ok("nearly every product has an image (>= 168 of ~170)", withImage.length >= 168, `${withImage.length}/${scraped.length}`)
ok("no imageUrl is a non-https string", scraped.every((p) => p.imageUrl == null || p.imageUrl.startsWith("https://")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates left null (migration-batch dates)", scraped.every((p) => p.releaseDate == null))
ok("gift card excluded", !scraped.some((p) => /gift card/i.test(p.name)))
// Free "Fabric Extension" add-ons are genuine catalogue rows and must be kept.
ok("free fabric extensions are kept", scraped.some((p) => /extension/i.test(p.name)))

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("a healthy number of bundles are flagged", bundles.length >= 30 && bundles.length <= 60, `${bundles.length}`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok("no possible-match fuzz -- clean URL alignment", summary.possibleMatches === 0, `possible ${summary.possibleMatches}`)
// The catalogue has 2 pairs of rows sharing a URL ("Aime" #4345/#4346, and
// "Mage & Mira" #4417/#4418 -- a pre-existing hyphen/en-dash duplicate), so 109
// rows collapse to 107 distinct URLs. Every distinct stored URL matches a live
// product; assert against the distinct count, not the raw row count.
const distinctExistingUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean)).size
console.log(`  distinct stored URLs: ${distinctExistingUrls} (of ${existing.length} rows)`)
ok("every distinct stored URL matched a live product", summary.existing === distinctExistingUrls, `existing ${summary.existing}/${distinctExistingUrls}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))
ok("new-pattern count is the expected ~60", summary.new >= 45 && summary.new <= 75, `${summary.new}`)

console.log(`\n  sample new rows:`)
newRows.slice(0, 10).forEach((r) => console.log(`     [${r.kind ?? "?"}] ${r.name}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
