// End-to-end check of the Love Notions adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-love-notions-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { decodeEntities } from "../app/lib/pattern-sync/adapters/love-notions.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- entity decoding -------------------------------------------------------
console.log("=== decodeEntities ===")
const decodeCases: [string, string][] = [
  ["Dockside Men&#8217;s Henley &amp; Polo", "Dockside Men’s Henley & Polo"],
  ["Girls&#8217; Classic Tee", "Girls’ Classic Tee"],
  ["Top &amp; Dress", "Top & Dress"],
  ["Plain Title", "Plain Title"],
]
for (const [input, expected] of decodeCases) {
  const got = decodeEntities(input)
  ok(`"${input}" -> "${expected}"`, got === expected, got === expected ? "" : `got "${got}"`)
}

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Love Notions", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "love-notions", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("love-notions") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("love-notions")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 145-165 band", scraped.length >= 145 && scraped.length <= 165, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("every URL is the /product/ shape", scraped.every((p) => /^https:\/\/(www\.)?lovenotions\.com\/product\/[^/]+\/?$/.test(p.url)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates left null (migration-batch dates)", scraped.every((p) => p.releaseDate == null))

// --- exclusion correctness -------------------------------------------------
// The filter must drop fabric kits, gift cards, licences, booth items and
// tools, while KEEPING courses and free patterns (both hold existing rows).
console.log("\n=== exclusions ===")
// Fabric kits are excluded by the `kits` category, not by name. Assert on the
// fabric-kit naming signature ("<Pattern> + <Fabric> Kit") rather than the bare
// word "kit" -- one real pattern, "Vanguard Kit" (a boys' garment in kids sizes,
// filed under boys-patterns/kids), is legitimately named "Kit" and must stay.
ok("no fabric-combo kit leaked (e.g. '... + ... Kit')", !scraped.some((p) => /\+.*\bkit\b/i.test(p.name)))
ok("no seam gauge / toolkit leaked", !scraped.some((p) => /seam gauge|tool ?kit/i.test(p.name)))
ok("no gift card leaked", !scraped.some((p) => /gift card|gift certificate/i.test(p.name)))
ok("no teaching licence leaked", !scraped.some((p) => /teaching licen[sc]e/i.test(p.name)))
// Courses are deliberately kept -- they exist as patterns in the catalogue.
const courses = scraped.filter((p) => /\bcourse\b/i.test(p.name))
ok("courses are KEPT (catalogue lists them as patterns)", courses.length >= 1, `${courses.length} course products kept`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// The whole point of the careful filter: every one of the 136 stored rows must
// still be present in the scrape. If the exclusion drops even one (as an early
// "exclude courses" cut did, losing 5 rows), this fails.
ok("ALL existing rows still matched (exclusion drops none)", summary.existing === existing.length, `${summary.existing}/${existing.length}`)
ok("zero possible (fuzzy) matches -- clean URL alignment", summary.possibleMatches === 0, `${summary.possibleMatches}`)
ok("new-pattern count is the expected ~17", summary.new >= 10 && summary.new <= 25, `${summary.new}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 10).forEach((r) => console.log(`     ${r.name}  ${r.url.replace(/^https:\/\/(www\.)?lovenotions\.com/, "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
