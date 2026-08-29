// End-to-end check of the Green Pepper adapter against the live store and the
// real catalogue, exercising the actual adapter, registry and comparePatterns
// rather than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && npx tsx scripts/verify-green-pepper-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { greenPepperHandle } from "../app/lib/pattern-sync/adapters/green-pepper.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- unit checks on the identity key ---------------------------------------
// The whole point of this adapter: the handle is stable across the six
// collection path prefixes the existing rows are split across.
console.log("=== identity key (handle) ===")
ok(
  "bare product path",
  greenPepperHandle("https://thegreenpepper.com/products/109-adults-polar-vest-pattern") ===
    "109-adults-polar-vest-pattern",
)
ok(
  "patterns collection path",
  greenPepperHandle("https://thegreenpepper.com/collections/patterns/products/109-adults-polar-vest-pattern") ===
    "109-adults-polar-vest-pattern",
)
ok(
  "patterns-for-adults collection path",
  greenPepperHandle(
    "https://thegreenpepper.com/collections/patterns-for-adults/products/109-adults-polar-vest-pattern",
  ) === "109-adults-polar-vest-pattern",
)
ok(
  "all six path forms agree",
  new Set(
    [
      "https://thegreenpepper.com/products/x-pattern",
      "https://thegreenpepper.com/collections/patterns/products/x-pattern",
      "https://thegreenpepper.com/collections/patterns-for-adults/products/x-pattern",
      "https://thegreenpepper.com/collections/patterns-for-kids/products/x-pattern",
      "https://thegreenpepper.com/collections/packs-bags-misc/products/x-pattern",
      "https://thegreenpepper.com/collections/hats-footwear-gloves/products/x-pattern",
    ].map(greenPepperHandle),
  ).size === 1,
)
ok("trailing slash tolerated", greenPepperHandle("https://thegreenpepper.com/products/x-pattern/") === "x-pattern")
ok("null-safe", greenPepperHandle(null) === null)

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Green Pepper", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "green-pepper", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("green-pepper") !== null)
ok("exposes identityKey", typeof getAdapterBySlug("green-pepper")?.identityKey === "function")

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("green-pepper")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} products in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("found a plausible catalogue size", scraped.length >= 120 && scraped.length <= 200, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("every URL is the bare /products/ form", scraped.every((p) => p.url.startsWith("https://thegreenpepper.com/products/")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("release dates all null (migration timestamps)", scraped.every((p) => p.releaseDate === null))

const handles = scraped.map((p) => greenPepperHandle(p.url))
ok("every URL yields an identity", handles.every(Boolean))
ok("identities are unique", new Set(handles).size === handles.length, `${handles.length - new Set(handles).size} dupes`)

const nonPatterns = scraped.filter((p) => p.kind !== "pattern")
console.log(`  non-pattern products flagged: ${nonPatterns.length}`)
nonPatterns.slice(0, 20).forEach((s) => console.log(`     [${s.kind}] ${s.name}`))
ok(
  "hardware/notions kits are flagged, not imported as patterns",
  scraped.some((p) => /hardware kit/i.test(p.name)) &&
    scraped.filter((p) => /hardware kit/i.test(p.name)).every((p) => p.kind === "other"),
)
ok(
  "how-to tutorials are flagged as not-a-pattern",
  scraped.some((p) => /^how to/i.test(p.name)) &&
    scraped.filter((p) => /^how to/i.test(p.name)).every((p) => p.kind === "other"),
)

// --- comparison against the real catalogue ---------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const identityKey = getAdapterBySlug("green-pepper")!.identityKey
const { rows, summary } = comparePatterns(scraped, existing, { identityKey })
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

// The point of handle identity: every stored row still listed upstream must be
// recognised as EXISTING, regardless of which collection path it was saved under.
const storedHandles = new Set(existing.map((p) => greenPepperHandle(p.url)).filter(Boolean))
const scrapedHandles = new Set(handles)
const recognisable = [...storedHandles].filter((h) => scrapedHandles.has(h!)).length
ok(
  "every still-listed catalogue row is recognised as EXISTING",
  summary.existing === recognisable,
  `existing=${summary.existing}, recognisable=${recognisable}`,
)
ok(
  "handle identity beats naive URL matching",
  summary.existing >= 100,
  `only ${summary.existing} recognised -- expected ~107`,
)

// A NEW row must not collide with anything already stored, by URL or identity.
const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))
ok("no NEW row collides with a stored identity", !newRows.some((r) => storedHandles.has(greenPepperHandle(r.url)!)))
ok(
  "every scraped row lands in exactly one status",
  rows.length === summary.found && summary.new + summary.possibleMatches + summary.existing === rows.length,
)
console.log(`  stored rows no longer listed upstream: ${[...storedHandles].filter((h) => !scrapedHandles.has(h!)).length}`)

console.log(`\n  sample new rows:`)
newRows.slice(0, 8).forEach((r) => console.log(`     [${r.kind}] ${r.name}  ${r.url.replace("https://thegreenpepper.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
