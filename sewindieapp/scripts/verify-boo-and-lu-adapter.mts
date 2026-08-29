// End-to-end check of the Boo and Lu adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-boo-and-lu-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { decodeEntities } from "../app/lib/pattern-sync/adapters/boo-and-lu.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- entity decoding -------------------------------------------------------
// WordPress emits titles HTML-encoded; getting this wrong corrupts every name
// with an apostrophe, ampersand or en-dash.
console.log("=== decodeEntities ===")
const decodeCases: [string, string][] = [
  ["Women&#8217;s Liana Top", "Women’s Liana Top"],
  ["Top &amp; Dress", "Top & Dress"],
  ["Reef &#8211; Rash Guard", "Reef – Rash Guard"],
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
  where: { name: { contains: "Boo and Lu", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "boo-and-lu", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("boo-and-lu") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("boo-and-lu")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 300-360 band", scraped.length >= 300 && scraped.length <= 360, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
// Two products (out of 324) have a featured_media id whose media record the API
// returns 401 for, so no image URL is retrievable -- imageUrl is left null for
// those, which the schema and sync both allow. Assert near-total coverage
// rather than 100%, and that whatever IS present is a real https URL.
const withImage = scraped.filter((p) => (p.imageUrl ?? "").startsWith("https://"))
ok("nearly every product has an image (>= 320 of 324)", withImage.length >= 320, `${withImage.length}/${scraped.length}`)
ok("no imageUrl is a non-https string", scraped.every((p) => p.imageUrl == null || p.imageUrl.startsWith("https://")))
ok("every URL is the /product/ shape", scraped.every((p) => /^https:\/\/booandlu\.com\/product\/[^/]+\/?$/.test(p.url)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all populated from WooCommerce", scraped.every((p) => Boolean(p.releaseDate)))

// Bundle detection is the union of category + title. A title-only bundle the
// store forgot to categorise must still be flagged, and a categorised combo
// with no "bundle" in its title must too.
const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("a healthy number of bundles are flagged", bundles.length >= 95 && bundles.length <= 120, `${bundles.length}`)
const wrenFawn = scraped.find((p) => /baby wren and fawn/i.test(p.name))
if (wrenFawn) ok('title-only bundle "Baby Wren and Fawn ... Bundle" flagged', wrenFawn.kind === "bundle", `got ${wrenFawn.kind}`)
const sakura = scraped.find((p) => /sakura top & dress/i.test(p.name) && /baby & adult/i.test(p.name))
if (sakura) ok('category-only combo "Baby & Adult Sakura" flagged as bundle', sakura.kind === "bundle", `got ${sakura.kind}`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// 18 stored rows are genuinely delisted (their /product/ slugs are absent from
// the live store), so not every stored row matches -- this is expected. Assert
// the matched count instead: every live product that maps to a stored URL is
// counted as existing, and the delisted rows are the difference.
ok("matched rows are exact URL matches (no possible-match fuzz)", summary.possibleMatches === 0, `possible ${summary.possibleMatches}`)
ok("most of the catalogue still matches (>= 140 of 165)", summary.existing >= 140, `existing ${summary.existing}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 8).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://booandlu.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
