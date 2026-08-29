// End-to-end check of the Itch to Stitch adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-itch-to-stitch-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { decodeEntities } from "../app/lib/pattern-sync/adapters/itch-to-stitch.ts"

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
  ["Simien Top &amp; Dress Digital Sewing Pattern (PDF)", "Simien Top & Dress Digital Sewing Pattern (PDF)"],
  ["Women&#8217;s Algarve Top", "Women’s Algarve Top"],
  ["Plain Title", "Plain Title"],
]
for (const [input, expected] of decodeCases) {
  const got = decodeEntities(input)
  ok(`"${input}" -> "${expected}"`, got === expected, got === expected ? "" : `got "${got}"`)
}

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Itch to Stitch", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "itch-to-stitch", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("itch-to-stitch") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("itch-to-stitch")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 145-165 band", scraped.length >= 145 && scraped.length <= 165, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("PDF acronym preserved verbatim (not re-cased to Pdf)", !scraped.some((p) => /\(Pdf\)/.test(p.name)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every URL is the /product/ shape", scraped.every((p) => /^https:\/\/(www\.)?itch-to-stitch\.com\/product\/[^/]+\/?$/.test(p.url)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all populated from WooCommerce", scraped.every((p) => Boolean(p.releaseDate)))
ok("no gift card leaked", !scraped.some((p) => /gift card/i.test(p.name)))
// No bundles on this store today -- every product should be a plain pattern.
ok("all products classified as plain patterns (no bundles today)", scraped.every((p) => p.kind === "pattern"))

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok("ALL existing rows still matched by URL", summary.existing === existing.length, `${summary.existing}/${existing.length}`)
ok("zero possible (fuzzy) matches -- clean URL alignment", summary.possibleMatches === 0, `${summary.possibleMatches}`)
ok("new-pattern count is the expected ~21", summary.new >= 12 && summary.new <= 30, `${summary.new}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 10).forEach((r) => console.log(`     ${r.name}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
