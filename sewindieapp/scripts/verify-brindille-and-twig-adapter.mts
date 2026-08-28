// End-to-end check of the Brindille & Twig adapter against the live store and
// the real catalogue, exercising the actual adapter, registry and
// comparePatterns rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-brindille-and-twig-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { toTitleCase } from "../app/lib/pattern-sync/adapters/brindille-and-twig.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- title casing ----------------------------------------------------------
// The load-bearing string logic for this adapter: the store lowercases its
// titles, so this is what makes new rows match the catalogue's Title Case.
// Getting the code-preservation wrong would corrupt every product's suffix.
console.log("=== toTitleCase ===")
const titleCases: [string, string][] = [
  ["a-line raglan dress : K025", "A-Line Raglan Dress : K025"],
  ["t-shirt dress : SS04", "T-Shirt Dress : SS04"], // season code stays uppercase
  ["hoodie : 83", "Hoodie : 83"], // bare numeric code preserved
  ["retro shorts/pants : 20", "Retro Shorts/Pants : 20"], // slash split
  ["romper : GU06", "Romper : GU06"],
  ["a line dress and top", "A Line Dress and Top"], // minor word stays lower, but leads => cap
  ["the essential leggings", "The Essential Leggings"], // leading minor word capitalised
  ["raglan tee family bundle", "Raglan Tee Family Bundle"],
]
for (const [input, expected] of titleCases) {
  const got = toTitleCase(input)
  ok(`"${input}" -> "${expected}"`, got === expected, got === expected ? "" : `got "${got}"`)
}

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Brindille", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "brindille-and-twig", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("brindille-and-twig") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("brindille-and-twig")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 185-210 band", scraped.length >= 185 && scraped.length <= 210, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every product Title-cased (no all-lowercase title)", !scraped.some((p) => /^[a-z]/.test(p.name)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok(
  "every URL is the /collections/all/products/ shape",
  scraped.every((p) => /^https:\/\/brindilletwig\.com\/collections\/all\/products\/[^/]+$/.test(p.url)),
)
ok("gift cards excluded", !scraped.some((p) => /gift .*card/i.test(p.name)))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates left null (migration-noise timestamps)", scraped.every((p) => p.releaseDate === null))

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
ok("the handful of bundles are flagged", bundles.length >= 4 && bundles.length <= 12, `${bundles.length}`)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok(
  "every stored row is still matched (exact URL match)",
  summary.existing === existing.length,
  `existing ${summary.existing} vs catalogue ${existing.length}`,
)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

console.log(`\n  sample new rows:`)
newRows.slice(0, 10).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://brindilletwig.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
