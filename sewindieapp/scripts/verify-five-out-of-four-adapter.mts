// End-to-end check of the 5 out of 4 Patterns adapter against the live store
// and the real catalogue, exercising the actual adapter, registry and
// comparePatterns rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-five-out-of-four-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { decodeEntities } from "../app/lib/pattern-sync/adapters/five-out-of-four.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- entity decoding -------------------------------------------------------
// The one piece of pure string logic worth unit-testing: WordPress emits the
// titles HTML-encoded, and getting this wrong corrupts every name with an
// apostrophe or en-dash.
console.log("=== decodeEntities ===")
const decodeCases: [string, string][] = [
  ["Kids&#8217; Hannah Bikini", "Kids’ Hannah Bikini"],
  ["2 Ways &#8211; Bow Add-on", "2 Ways – Bow Add-on"],
  ["Tank, Top &amp; Dress", "Tank, Top & Dress"],
  ["Plain Title", "Plain Title"],
  ["Extra   spaces\tcollapsed", "Extra spaces collapsed"],
]
for (const [input, expected] of decodeCases) {
  const got = decodeEntities(input)
  ok(`"${input}" -> "${expected}"`, got === expected, got === expected ? "" : `got "${got}"`)
}

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "5 out of 4", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "5-out-of-4-patterns", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("5-out-of-4-patterns") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("5-out-of-4-patterns")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 300-340 band", scraped.length >= 300 && scraped.length <= 340, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every URL is the bare /product/ shape", scraped.every((p) => /^https:\/\/5outof4\.com\/product\/[^/]+\/?$/.test(p.url)))
ok("no cut file leaked through (category + title exclusion)", !scraped.some((p) => /\bcut file\b[\s!.]*$/i.test(p.name)))
ok("gift certificate excluded", !scraped.some((p) => /gift certificate/i.test(p.name)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all populated from WooCommerce", scraped.every((p) => Boolean(p.releaseDate)))

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("a healthy number of bundles are flagged", bundles.length >= 70 && bundles.length <= 110, `${bundles.length}`)
// The "add-on" title must NOT be a bundle/addon -- it is a standalone pattern.
const scrunchie = scraped.find((p) => /scrunchie/i.test(p.name))
if (scrunchie) ok('"DIY Scrunchie ... Add-on" stays a pattern', scrunchie.kind === "pattern", `got ${scrunchie.kind}`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok("every stored row is still matched (exact URL match)", summary.existing === existing.length, `existing ${summary.existing} vs catalogue ${existing.length}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 8).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://5outof4.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
