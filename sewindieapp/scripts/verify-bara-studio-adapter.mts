// End-to-end check of the Bara Studio adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && npx tsx scripts/verify-bara-studio-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { baraHandle, normalizeBaraTitle } from "../app/lib/pattern-sync/adapters/bara-studio.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- unit checks on the identity key ---------------------------------------
// Existing rows live under /en/collections/schnittmuster/products/<handle>,
// which redirects to the bare /products/<handle>. Both must key identically.
console.log("=== identity key (handle) ===")
ok(
  "en/collections path",
  baraHandle("https://www.bara-studio.com/en/collections/schnittmuster/products/e-book-bluse-adela") ===
    "e-book-bluse-adela",
)
ok("bare product path", baraHandle("https://www.bara-studio.com/products/e-book-bluse-adela") === "e-book-bluse-adela")
ok(
  "both forms agree",
  new Set(
    [
      "https://www.bara-studio.com/en/collections/schnittmuster/products/x",
      "https://www.bara-studio.com/products/x",
      "https://www.bara-studio.com/collections/schnittmuster/products/x",
    ].map(baraHandle),
  ).size === 1,
)
ok("null-safe", baraHandle(null) === null)

// --- unit checks on title normalisation ------------------------------------
console.log("\n=== title normalisation ===")
ok('trailing space + lowercase token -> "E-Book Shopper Mira"', normalizeBaraTitle("e-book shopper Mira ", "E-book") === "E-Book Shopper Mira")
ok("token added for E-book type without token", normalizeBaraTitle("Tote Bag Emma", "E-book") === "E-Book Tote Bag Emma")
ok("existing token canonicalised in place, not duplicated", normalizeBaraTitle("Julia dress e-book ", "E-book") === "Julia Dress E-Book")
ok("hyphenated word cased correctly", normalizeBaraTitle("E-book bell-bottoms Smilla", "E-book") === "E-Book Bell-Bottoms Smilla")
ok("German title kept, prefixed", normalizeBaraTitle("Hundebett Leni", "E-Book") === "E-Book Hundebett Leni")
ok("add-on title not force-prefixed", !/^E-Book/i.test(normalizeBaraTitle("Add on cuffs", "add on")))

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Bara Studio", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "bara-studio", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("bara-studio") !== null)
ok("exposes identityKey", typeof getAdapterBySlug("bara-studio")?.identityKey === "function")

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("bara-studio")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} products in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("found a plausible catalogue size (e-book + add-on)", scraped.length >= 45 && scraped.length <= 90, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every URL is the bare /products/ form", scraped.every((p) => p.url.startsWith("https://www.bara-studio.com/products/")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("release dates all null (migration timestamps)", scraped.every((p) => p.releaseDate === null))
ok("no fabric/accessory leaked in (title heuristic)", !scraped.some((p) => /\b(stoff|fabric|meterware)\b/i.test(p.name)))

const handles = scraped.map((p) => baraHandle(p.url))
ok("every URL yields an identity", handles.every(Boolean))
ok("identities are unique", new Set(handles).size === handles.length, `${handles.length - new Set(handles).size} dupes`)

const bundles = scraped.filter((p) => p.kind === "bundle")
console.log(`  bundles flagged: ${bundles.length}`)
bundles.forEach((b) => console.log(`     [bundle] ${b.name}`))
ok("the two sewing-pattern bundles are flagged as bundles", bundles.length >= 2)

const addons = scraped.filter((p) => p.kind === "addon")
console.log(`  add-ons flagged: ${addons.length}`)

// --- comparison against the real catalogue ---------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const identityKey = getAdapterBySlug("bara-studio")!.identityKey
const { rows, summary } = comparePatterns(scraped, existing, { identityKey })
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// Every stored row still listed upstream must be recognised as EXISTING.
const storedHandles = new Set(existing.map((p) => baraHandle(p.url)).filter(Boolean))
const scrapedHandles = new Set(handles)
const recognisable = [...storedHandles].filter((h) => scrapedHandles.has(h!)).length
ok(
  "every still-listed catalogue row is recognised as EXISTING",
  summary.existing === recognisable,
  `existing=${summary.existing}, recognisable=${recognisable}`,
)
ok("handle identity recognises the bulk of the catalogue", summary.existing >= 50, `only ${summary.existing} recognised`)

// A NEW row must not collide with anything already stored, by URL or identity.
const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))
ok("no NEW row collides with a stored identity", !newRows.some((r) => storedHandles.has(baraHandle(r.url)!)))
ok(
  "every scraped row lands in exactly one status",
  rows.length === summary.found && summary.new + summary.possibleMatches + summary.existing === rows.length,
)
console.log(`  stored rows no longer listed upstream: ${[...storedHandles].filter((h) => !scrapedHandles.has(h!)).length}`)

console.log(`\n  sample new rows:`)
newRows.slice(0, 8).forEach((r) => console.log(`     [${r.kind}] ${r.name}  ${r.url.replace("https://www.bara-studio.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
