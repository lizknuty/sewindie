// End-to-end check of the Folkwear adapter against the live store and the real
// catalogue, exercising the actual adapter, registry and comparePatterns rather
// than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-folkwear-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- registry wiring -------------------------------------------------------
console.log("=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Folkwear", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "folkwear", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("folkwear") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("folkwear")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 150-185 band", scraped.length >= 150 && scraped.length <= 185, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every URL is the /collections/all/products/ shape", scraped.every((p) => /^https:\/\/www\.folkwear\.com\/collections\/all\/products\/[^/]+$/.test(p.url)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all null (migrated store)", scraped.every((p) => p.releaseDate === null))

// The whole point of this adapter: non-pattern merch must be filtered out. If
// the product_type filter regresses, fabric/kits/thread would flood in and
// these canaries would appear.
const leakage = ["Metrosene", "Sashiko Thread", "cross stitch", "Fabric Remnants", "Handloom Cotton", "IL State Tax", "Button Hole Cutter", "Gift Card"]
for (const canary of leakage) {
  ok(`non-pattern "${canary}" filtered out`, !scraped.some((p) => p.name.toLowerCase().includes(canary.toLowerCase())))
}
// The two oddly-typed real patterns must survive the filter.
ok('"254 Swing Coat" (type "sewing pattern") kept', scraped.some((p) => /254 swing coat/i.test(p.name)))
ok('"234 Cameos" (type "knitting pattern") kept', scraped.some((p) => /234 cameos/i.test(p.name)))

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("a sensible number of bundles are flagged", bundles.length >= 5 && bundles.length <= 15, `${bundles.length}`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// 7 stored rows are gone from the live store: 4 free patterns are genuinely
// delisted, and 3 numbered patterns were re-listed under handles without the
// "-pdf" suffix (so they resurface as new -- correct sync behaviour, not a bug).
// Assert the bulk of the catalogue still matches by URL rather than demanding
// 100%.
ok("most of the catalogue still matches by URL (>= 135 of 149)", summary.existing >= 135, `existing ${summary.existing}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 8).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://www.folkwear.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
