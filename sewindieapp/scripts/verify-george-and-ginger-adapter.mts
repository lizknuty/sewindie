// End-to-end check of the George & Ginger adapter against the live store and
// the real catalogue, exercising the actual adapter, registry and
// comparePatterns rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-george-and-ginger-adapter.mts

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
  where: { name: { contains: "George", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "george-and-ginger", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("george-and-ginger") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("george-and-ginger")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 150-185 band", scraped.length >= 150 && scraped.length <= 185, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every URL is the bare /products/ shape", scraped.every((p) => /^https:\/\/georgeandgingerpatterns\.com\/products\/[^/]+$/.test(p.url)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all left null (migration timestamps)", scraped.every((p) => p.releaseDate == null))
ok("gift card excluded", !scraped.some((p) => /^gift card$/i.test(p.name.trim())))

// Titles are verbatim: the store's higher-quality casing must survive, so the
// correct forms "PDF", "YouTube", "FREE" must be present (the DB damaged these
// to "Pdf", "Youtube", "Free").
ok("verbatim casing kept: 'PDF' present", scraped.some((p) => /\bPDF\b/.test(p.name)))
ok("verbatim casing kept: 'YouTube' preserved where present", !scraped.some((p) => /youtube/i.test(p.name) && !/YouTube/.test(p.name)))
ok("no residual '(YouTube Exclusive)' damaged to 'Youtube'", !scraped.some((p) => /\bYoutube\b/.test(p.name)))

// Bundle classification: "Bundle"/"Collection"/"Pack" flagged; "Set" NOT.
const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
// Only "Bundle" / "Collection" / "Pack" titles are true multi-pattern bundles.
// "Set" is deliberately NOT a bundle signal here -- G&G sells single garment
// "Sets" ("The Unwind Set", "The Rave Shirt Set") as one pattern, so folding
// "Set" in would wrongly flag ~17 real patterns. That leaves ~15 genuine
// bundles, which is the healthy band.
ok("a healthy number of bundles are flagged", bundles.length >= 10 && bundles.length <= 25, `${bundles.length}`)
const set = scraped.find((p) => /\bThe Unwind Set\b/i.test(p.name))
if (set) ok('"The Unwind Set" is NOT flagged as a bundle', set.kind === "pattern", `got ${set.kind}`)
const collection = scraped.find((p) => /Polar Dress Collection/i.test(p.name))
if (collection) ok('"... Collection" is flagged as a bundle', collection.kind === "bundle", `got ${collection.kind}`)

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
const distinctExistingUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean)).size
ok("every distinct stored URL matched a live product", summary.existing === distinctExistingUrls, `existing ${summary.existing}/${distinctExistingUrls}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 10).forEach((r) => console.log(`     [${r.kind ?? "?"}] ${r.name}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
