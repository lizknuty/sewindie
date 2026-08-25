// Verifies the Violette Field Threads adapter against the live store and the
// live catalogue, exercising the real adapter and the real comparePatterns
// rather than a reimplementation of either.
//
// Run with:
//   set -a && source /vercel/share/.env.project && set +a && \
//     node sewindieapp/scripts/verify-vft-adapter.mts
//
// Read-only: it never writes to the database.

import { violetteFieldThreadsAdapter as vft } from "../app/lib/pattern-sync/adapters/violette-field-threads.ts"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const DESIGNER_ID = 117
let allOk = true

function ok(label: string, cond: boolean, detail = "") {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`)
  if (!cond) allOk = false
  return cond
}

const designer = await prisma.designer.findUnique({
  where: { id: DESIGNER_ID },
  select: { id: true, name: true, url: true },
})
if (!designer) throw new Error(`designer ${DESIGNER_ID} missing`)

console.log(`Designer: ${designer.name}  url=${designer.url}\n`)

console.log("=== registry wiring ===")
ok("resolves by designer URL", getAdapterForDesigner(designer)?.slug === "violette-field-threads")
ok("resolves by slug", getAdapterBySlug("violette-field-threads")?.label === "Violette Field Threads")

console.log("\n=== fetch catalogue (live) ===")
const t0 = Date.now()
const scraped = await vft.fetchCatalogue()
console.log(`  fetched ${scraped.length} products in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

ok("catalogue is non-trivial", scraped.length > 900, `${scraped.length}`)
ok("every row has a name", scraped.every((r) => r.name.trim().length > 0))
ok("every row has an image", scraped.every((r) => !!r.imageUrl))
ok("every name within 255 chars", scraped.every((r) => r.name.length <= 255))
ok("no duplicate URLs in feed", new Set(scraped.map((r) => r.url)).size === scraped.length)
ok("no duplicate sourceIds", new Set(scraped.map((r) => r.sourceId)).size === scraped.length)
ok(
  "all URLs on an allowed host",
  scraped.every((r) => {
    const host = new URL(r.url).hostname.toLowerCase().replace(/^www\./, "")
    return vft.matchHosts.map((h) => h.replace(/^www\./, "")).includes(host)
  }),
)
ok(
  "all URLs use the /collections/all/products/ shape",
  scraped.every((r) => new URL(r.url).pathname.startsWith("/collections/all/products/")),
)

console.log("\n=== title fidelity (no title-casing) ===")
ok('no name contains " Of <n>"', !scraped.some((r) => / Of \d/.test(r.name)), "guards the 'Bundle Of 3' bug")
ok('"Pdf" never appears', !scraped.some((r) => /\bPdf\b/.test(r.name)))

console.log("\n=== kind distribution ===")
const kinds = new Map<string, number>()
for (const row of scraped) kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1)
for (const [kind, count] of [...kinds].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${kind}`)
}
const addonBundle = scraped.find((r) => /Blithe Maxi Add-on Complete Bundle of 4/i.test(r.name))
if (addonBundle) ok("add-on bundle classified as bundle", addonBundle.kind === "bundle", addonBundle.kind)
const plainAddon = scraped.find((r) => r.name === "Molly Girls Hood Add-on")
if (plainAddon) ok("plain add-on classified as addon", plainAddon.kind === "addon", plainAddon.kind)

console.log("\n=== release dates ===")
const withDate = scraped.filter((r) => r.releaseDate)
console.log(`  kept ${withDate.length}, nulled ${scraped.length - withDate.length}`)
ok("all kept dates parse", withDate.every((r) => !Number.isNaN(new Date(r.releaseDate!).getTime())))
ok("no future dates", !withDate.some((r) => new Date(r.releaseDate!) > new Date()))
ok("no dates before 2010", !withDate.some((r) => new Date(r.releaseDate!) < new Date("2010-01-01")))

const migrationBatch = scraped.filter((r) => r.name === "Blithe Doll Dress" || r.name === "Clementine Doll Jacket")
if (migrationBatch.length === 2) {
  ok(
    "2017 cross-family migration batch nulled",
    migrationBatch.every((r) => r.releaseDate === null),
    migrationBatch.map((r) => `${r.name}=${r.releaseDate}`).join(", "),
  )
}
for (const family of ["Gardenia ", "Colette ", "Winnie "]) {
  const group = scraped.filter((r) => r.name.startsWith(family))
  if (group.length > 1) {
    ok(`${family.trim()} coordinated release kept`, group.every((r) => r.releaseDate !== null), `${group.length} rows`)
  }
}

console.log("\n=== compare against live catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: DESIGNER_ID },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  DB rows: ${existing.length}`)
console.log(`  found=${summary.found}  new=${summary.new}  possible=${summary.possibleMatches}  existing=${summary.existing}`)

// The regression that matters most: the conventional /products/<handle> shape
// would report ~0 existing and offer the entire catalogue for re-import.
ok("existing dominates, so the URL shape matches the catalogue", summary.existing > 1000, `${summary.existing}`)
ok("new is a small delta", summary.new < 100, `${summary.new}`)
ok("not re-offering the whole catalogue", summary.new < existing.length / 2)

const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
const newRows = rows.filter((r) => r.status === "NEW")
ok("no NEW row collides with an existing URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log("\n=== NEW rows that would be offered ===")
for (const row of newRows) {
  console.log(`  ${(row.releaseDate ?? "(no date)  ").slice(0, 10)}  ${row.kind.padEnd(7)}  ${row.name}`)
}

console.log(`\n${allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`)

await prisma.$disconnect()
await pool.end()
process.exit(allOk ? 0 : 1)
