// End-to-end check of the Wardrobe By Me adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && npx tsx scripts/verify-wardrobe-by-me-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { wardrobeByMeHandle } from "../app/lib/pattern-sync/adapters/wardrobe-by-me.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- unit checks on the identity key ---------------------------------------
console.log("=== identity key (handle) ===")
ok("bare product path", wardrobeByMeHandle("https://wardrobebyme.com/products/abby-dress-sewing-pattern") === "abby-dress-sewing-pattern")
ok(
  "collection path (the stored form)",
  wardrobeByMeHandle("https://wardrobebyme.com/collections/sewing-patterns-wardrobebyme/products/abby-dress-sewing-pattern") ===
    "abby-dress-sewing-pattern",
)
ok(
  "both path forms agree",
  wardrobeByMeHandle("https://wardrobebyme.com/products/x") ===
    wardrobeByMeHandle("https://wardrobebyme.com/collections/sewing-patterns-wardrobebyme/products/x"),
)
ok("trailing slash tolerated", wardrobeByMeHandle("https://wardrobebyme.com/products/x/") === "x")
ok("null-safe", wardrobeByMeHandle(null) === null)

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Wardrobe By Me", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "wardrobe-by-me", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("wardrobe-by-me") !== null)
ok("exposes identityKey", typeof getAdapterBySlug("wardrobe-by-me")?.identityKey === "function")

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("wardrobe-by-me")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} products in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("found a plausible PDF-only catalogue size", scraped.length >= 120 && scraped.length <= 160, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every URL is the bare /products/ form", scraped.every((p) => p.url.startsWith("https://wardrobebyme.com/products/")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("release dates are populated (store exposes real ones)", scraped.filter((p) => p.releaseDate).length > scraped.length * 0.9)

// Decision 1: paper products must be excluded. A "Paper Pattern" title leaking
// through would mean the product_type filter broke.
ok(
  "no Paper product leaked in",
  !scraped.some((p) => /\bpaper\b/i.test(p.name)),
  scraped.filter((p) => /\bpaper\b/i.test(p.name)).map((p) => p.name).slice(0, 3).join(" | "),
)

const handles = scraped.map((p) => wardrobeByMeHandle(p.url))
ok("every URL yields an identity", handles.every(Boolean))
ok("identities are unique", new Set(handles).size === handles.length, `${handles.length - new Set(handles).size} dupes`)

const nonPatterns = scraped.filter((p) => p.kind !== "pattern")
console.log(`  non-pattern products flagged: ${nonPatterns.length}`)
nonPatterns.forEach((s) => console.log(`     [${s.kind}] ${s.name}`))

// --- comparison against the real catalogue ---------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const identityKey = getAdapterBySlug("wardrobe-by-me")!.identityKey
const { rows, summary } = comparePatterns(scraped, existing, { identityKey })
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

const storedHandles = new Set(existing.map((p) => wardrobeByMeHandle(p.url)).filter(Boolean))
const scrapedHandles = new Set(handles)
const recognisable = [...storedHandles].filter((h) => scrapedHandles.has(h!)).length
ok(
  "every still-listed catalogue row is recognised as EXISTING",
  summary.existing === recognisable,
  `existing=${summary.existing}, recognisable=${recognisable}`,
)
// 72 of 108 stored handles map to a live PDF product; the rest are renamed or
// discontinued handles that fall to name matching. Guard the floor.
ok("a solid majority of stored rows are recognised", summary.existing >= 65, `only ${summary.existing} recognised`)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))
ok("no NEW row collides with a stored identity", !newRows.some((r) => storedHandles.has(wardrobeByMeHandle(r.url)!)))
ok(
  "every scraped row lands in exactly one status",
  rows.length === summary.found && summary.new + summary.possibleMatches + summary.existing === rows.length,
)
console.log(`  stored rows no longer listed upstream (renamed/paper/removed): ${[...storedHandles].filter((h) => !scrapedHandles.has(h!)).length}`)

console.log(`\n  sample possible matches (renamed handles, name-matched):`)
rows.filter((r) => r.status === "POSSIBLE_MATCH").slice(0, 6).forEach((r) => console.log(`     "${r.name}"  ~  "${r.matchedPattern?.name}"`))
console.log(`\n  sample new rows:`)
newRows.slice(0, 6).forEach((r) => console.log(`     [${r.kind}] ${r.name}  ${r.url.replace("https://wardrobebyme.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
