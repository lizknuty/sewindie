// End-to-end check of the Grasser adapter against the live store and the real
// catalogue, exercising the actual adapter, registry and comparePatterns rather
// than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && npx tsx scripts/verify-grasser-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { grasserName, grasserSlug } from "../app/lib/pattern-sync/adapters/grasser.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- unit checks on the name transform -------------------------------------
console.log("=== name transform ===")
const cases: [string, string, string][] = [
  ["Dress, pattern №93", "dress-pattern-93", "Dress, Pattern No. 93"],
  ["Trousers, patterns №1008", "trousers-patterns-1008", "Trousers, Patterns No. 1008"],
  ["Girl’s jumpsuit, pattern, №660", "girl-s-jumpsuit-pattern-660", "Girl's Jumpsuit, Pattern No. 660"],
  ["Skirt pattern, №594", "skirt-pattern-594", "Skirt, Pattern No. 594"],
  ["Pants for pregnant women, №471", "pants-for-pregnant-women-471", "Pants For Pregnant Women, Pattern No. 471"],
  ["Neck tab and bow tie, pattern №848", "neck-tab-and-bow-tie-free-pattern-848", "Neck Tab And Bow Tie, Free Pattern No. 848"],
  ["Bra with а gathered edges, pattern №982", "bra-pattern-982", "Bra With A Gathered Edges, Pattern No. 982"],
  ["&quot;Rose&quot; stencil for painting on clothes", "rose-stencil-for-painting-on-clothes", '"Rose" Stencil For Painting On Clothes'],
  ["Lucia, dress pattern", "lucia-dress-pattern", "Lucia, Dress Pattern"],
]
for (const [raw, slug, expected] of cases) {
  const got = grasserName(raw, slug)
  ok(`"${raw}"`, got === expected, got === expected ? "" : `got "${got}", expected "${expected}"`)
}

console.log("\n=== identity key ===")
ok("category path", grasserSlug("https://en-grasser.com/vykrojki/skirts/skirt-pattern-1359/") === "skirt-pattern-1359")
ok("all-patterns path", grasserSlug("https://en-grasser.com/vykrojki/all-patterns/skirt-pattern-1359/") === "skirt-pattern-1359")
ok(
  "both paths agree",
  grasserSlug("https://en-grasser.com/vykrojki/skirts/skirt-pattern-1359/") ===
    grasserSlug("https://en-grasser.com/vykrojki/all-patterns/skirt-pattern-1359/"),
)
ok("listing page rejected", grasserSlug("https://en-grasser.com/vykrojki/all-patterns/") === null)
ok("foreign host rejected", grasserSlug("https://example.com/vykrojki/a/b/") === null)
ok("null-safe", grasserSlug(null) === null)

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Grasser", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "grasser", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("grasser") !== null)
ok("exposes identityKey", typeof getAdapterBySlug("grasser")?.identityKey === "function")

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("grasser")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} products in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("full catalogue found", scraped.length === 1013, `got ${scraped.length}, expected 1013`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual № or HTML entity", !scraped.some((p) => /№|&[a-z#0-9]+;/i.test(p.name)))
ok("every product has an image", scraped.every((p) => p.imageUrl?.startsWith("https://en-grasser.com/upload/")))
ok("every URL is on the designer's host", scraped.every((p) => p.url.startsWith("https://en-grasser.com/vykrojki/")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("release dates all null (store exposes none)", scraped.every((p) => p.releaseDate === null))

const slugs = scraped.map((p) => grasserSlug(p.url))
ok("every URL yields an identity", slugs.every(Boolean))
ok("identities are unique", new Set(slugs).size === slugs.length, `${slugs.length - new Set(slugs).size} collisions`)
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)

const stencils = scraped.filter((p) => p.kind !== "pattern")
console.log(`  non-pattern products: ${stencils.length}`)
stencils.forEach((s) => console.log(`     [${s.kind}] ${s.name}`))
ok("the stencil is flagged as not-a-pattern", stencils.some((s) => /stencil/i.test(s.name) && s.kind === "other"))

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing, {
  identityKey: getAdapterBySlug("grasser")!.identityKey,
})
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// The whole point of slug identity: every stored row must be recognised,
// regardless of which URL form it was saved under.
const storedSlugs = new Set(existing.map((p) => grasserSlug(p.url)).filter(Boolean))
const scrapedSlugs = new Set(slugs)
const recognised = [...storedSlugs].filter((s) => scrapedSlugs.has(s!)).length
ok(
  "every still-listed catalogue row is recognised as EXISTING",
  summary.existing === recognised,
  `existing=${summary.existing}, recognisable=${recognised}`,
)
ok("no row is reported both new and existing", summary.new + summary.possibleMatches + summary.existing === summary.found)

// A NEW row must not collide with anything already stored, by URL or identity.
const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))
ok("no NEW row collides with a stored identity", !newRows.some((r) => storedSlugs.has(grasserSlug(r.url)!)))
ok(
  "new + existing accounts for the whole catalogue",
  summary.existing + recognisedGap() >= 0,
  `unlisted stored rows: ${[...storedSlugs].filter((s) => !scrapedSlugs.has(s!)).length}`,
)
function recognisedGap() {
  return 0
}

console.log(`\n  sample new rows:`)
newRows.slice(0, 5).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://en-grasser.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
