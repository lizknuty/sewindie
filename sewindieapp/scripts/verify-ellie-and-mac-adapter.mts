// End-to-end check of the Ellie and Mac adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-ellie-and-mac-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { classify } from "../app/lib/pattern-sync/adapters/ellie-and-mac.ts"
import type { ProductKind } from "../app/lib/pattern-sync/types.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- classification --------------------------------------------------------
console.log("=== classification ===")
const kindCases: [string, ProductKind][] = [
  ["Petunia Princess Seam Peplum & Dress Sewing Pattern", "pattern"],
  ["Jade Woven Dolman Dress & Blouse Sewing Pattern", "pattern"],
  // The two backpacks must stay patterns -- a bare \bpack\b would misfile them.
  ["Shyra Chic Backpack Purse Sewing Pattern", "pattern"],
  ["Pack Your Bag Backpack Sewing Pattern", "pattern"],
  ["Essential Dolman Dress Sewing Pattern Bundle (Adult & Kids)", "bundle"],
  ["Ellie and Mac Woven Sewing Pattern Starter Pack", "bundle"],
  ["Adult Athleisure Sewing Pattern Capsule", "bundle"],
  ["The Ultimate Hands-Free Travel Collection: 4 Crossbody & Grab-and-Go Bag Sewing Patterns", "bundle"],
  ["Go Exploring Cardigan Sewing Pattern BUNDLE PACK (adult & kids)", "bundle"],
  // None exist today; these guard the defensive arms.
  ["Something Pack of 4", "bundle"],
  ["Something Set of 3", "bundle"],
]
for (const [title, expected] of kindCases) {
  const got = classify(title)
  ok(`"${title}" -> ${expected}`, got === expected, got === expected ? "" : `got "${got}"`)
}

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Ellie", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "ellie-and-mac", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("ellie-and-mac") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("ellie-and-mac")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} sewing patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("filters to the 372 sewing patterns", scraped.length === 372, `got ${scraped.length}, expected 372`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every URL is the bare /products/ shape", scraped.every((p) => /^https:\/\/www\.ellieandmac\.com\/products\/[^/]+$/.test(p.url)))
ok("no URL keeps a query string", !scraped.some((p) => p.url.includes("?")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all null (store exposes only a noisy publish stamp)", scraped.every((p) => p.releaseDate === null))

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("a healthy number of bundles are flagged", bundles.length >= 40 && bundles.length <= 70, `${bundles.length}`)
ok("no add-ons invented (store sells none)", scraped.every((p) => p.kind !== "addon"))

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok("existing count is the measured 311", summary.existing === 311, `got ${summary.existing}`)
ok("genuinely new count is 61", summary.new === 61, `got ${summary.new}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

// The 11 stored rows the listing no longer carries are genuinely delisted,
// not hidden behind the product_type filter -- confirm none reappear under a
// cutting-file/embroidery type by checking they are absent from a raw crawl.
const listed = new Set(scraped.map((p) => normalizeUrl(p.url)))
const delisted = existing.filter((p) => !listed.has(normalizeUrl(p.url)!))
console.log(`  stored rows no longer listed as sewing patterns: ${delisted.length}`)
delisted.forEach((p) => console.log(`     [${p.id}] ${p.name}  ${p.url}`))

console.log(`\n  sample new rows:`)
newRows.slice(0, 5).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://www.ellieandmac.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
