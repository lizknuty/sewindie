// End-to-end check of the Peek-a-Boo adapter against the live store and the real
// catalogue, exercising the actual adapter, registry and comparePatterns rather
// than reimplementing any of it.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-peekaboo-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeName, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { classify, decodeEntities } from "../app/lib/pattern-sync/adapters/peekaboo-pattern-shop.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- entity decoding -------------------------------------------------------
console.log("=== entity decoding ===")
const decodeCases: [string, string][] = [
  ["Girl&#x27;s Babydoll Top Pattern", "Girl's Babydoll Top Pattern"],
  ["Men&#39;s Baja Shorts Pattern", "Men's Baja Shorts Pattern"],
  ["Alex &amp; Anna Pajama Pattern", "Alex & Anna Pajama Pattern"],
  ["Pocketful of Posies Dress &amp; Tunic Pattern", "Pocketful of Posies Dress & Tunic Pattern"],
  ["Plain Title", "Plain Title"],
  // Ampersand is decoded last, so a double-encoded apostrophe stays literal
  // rather than silently becoming one.
  ["Girl&amp;#39;s Top", "Girl&#39;s Top"],
]
for (const [raw, expected] of decodeCases) {
  const got = decodeEntities(raw)
  ok(`"${raw}"`, got === expected, got === expected ? "" : `got "${got}"`)
}

// Capitalisation must survive untouched -- the whole point of note 3.
ok("preserves OG", decodeEntities("Adult OG Oversized Tee Pattern") === "Adult OG Oversized Tee Pattern")
ok("preserves PJs", decodeEntities("Men&#x27;s Night Owl PJs") === "Men's Night Owl PJs")
ok("preserves lowercase and", decodeEntities("Harlow Dress and Romper Pattern") === "Harlow Dress and Romper Pattern")

// --- classification --------------------------------------------------------
console.log("\n=== classification ===")
const kindCases: [string, string][] = [
  ["Girl's Babydoll Top Pattern", "pattern"],
  ["Wren Sweatshirt Dress", "pattern"],
  ["Isolation Gown Pattern", "pattern"],
  ["Drawstring Gift Bags Free Pattern", "pattern"],
  ["Adult Hoodie Add-On Pack", "addon"],
  ["Gloria Circle Skirt Add-On", "addon"],
  ["Milan Maternity Add-On Pack", "addon"],
  ["2026 Sewing Challenge Printable", "other"],
  ["Tie Applique Template", "other"],
  // None exist today; these guard the defensive branch.
  ["Complete Bundle of 4", "bundle"],
  ["Starter Pack of 18", "bundle"],
]
for (const [title, expected] of kindCases) {
  const got = classify(title)
  ok(`"${title}" -> ${expected}`, got === expected, got === expected ? "" : `got "${got}"`)
}
// A cardigan must not be mistaken for a gift card by a sloppy substring test.
ok("cardigan is a pattern", classify("Women's V-Neck Cardigan Pattern") === "pattern")

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Peek", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "peekaboo-pattern-shop", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("peekaboo-pattern-shop") !== null)
// This store must NOT use the Grasser identity hook -- see note 1.
ok(
  "does not define identityKey",
  typeof getAdapterBySlug("peekaboo-pattern-shop")?.identityKey !== "function",
)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("peekaboo-pattern-shop")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} products in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("full catalogue found", scraped.length === 431, `got ${scraped.length}, expected 431`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual HTML entity", !scraped.some((p) => /&[a-z#0-9]+;/i.test(p.name)))
ok("every product has an image", scraped.every((p) => p.imageUrl?.startsWith("https://cdn11.bigcommerce.com/")))
ok("every URL is on the canonical host", scraped.every((p) => p.url.startsWith("https://www.peekaboopatternshop.com/")))
ok("no URL keeps a query string", !scraped.some((p) => p.url.includes("?")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("source ids are numeric BigCommerce ids", scraped.every((p) => /^\d+$/.test(p.sourceId)))
ok("source ids are unique", new Set(scraped.map((p) => p.sourceId)).size === scraped.length)
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all null (store exposes none)", scraped.every((p) => p.releaseDate === null))

const nonPatterns = scraped.filter((p) => p.kind !== "pattern")
console.log(`  non-pattern products: ${nonPatterns.length}`)
nonPatterns.forEach((p) => console.log(`     [${p.kind}] ${p.name}`))
ok("the printable is flagged", nonPatterns.some((p) => /printable/i.test(p.name) && p.kind === "other"))
ok("the five add-ons are flagged", scraped.filter((p) => p.kind === "addon").length === 5)

// --- comparison against the real catalogue --------------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing, {
  identityKey: getAdapterBySlug("peekaboo-pattern-shop")!.identityKey,
})
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)

ok("existing count is the measured 338", summary.existing === 338, `got ${summary.existing}`)
// The 93 rows the URL match misses are NOT all new: the store has re-slugged 33
// products ("kids-raincoat-pattern" -> "kid-s-raincoat-pattern", "sierra-
// pullover" -> "sierra-pullover-pattern"), and the name fallback catches every
// one as POSSIBLE_MATCH so an admin decides instead of silently duplicating.
ok("genuinely new count is 60", summary.new === 60, `got ${summary.new}`)
ok("re-slugged products are flagged, not duplicated", summary.possibleMatches === 33, `got ${summary.possibleMatches}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)

// The apex/www split must be absorbed by normalizeUrl, not left to chance:
// every stored row still on the listing has to come back EXISTING.
const listed = new Set(scraped.map((p) => normalizeUrl(p.url)))
const recognisable = existing.filter((p) => listed.has(normalizeUrl(p.url)!)).length
ok(
  "every still-listed stored row is recognised despite the apex/www difference",
  summary.existing === recognisable,
  `existing=${summary.existing}, recognisable=${recognisable}`,
)

const newRows = rows.filter((r) => r.status === "NEW")
const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter(Boolean))
ok("no NEW row collides with a stored URL", !newRows.some((r) => takenUrls.has(normalizeUrl(r.url)!)))

// Every POSSIBLE_MATCH must be a real re-slug rather than a loose name
// collision: the listing name and the stored name have to agree once casing and
// punctuation are normalised. If this ever fails, the fallback is guessing.
const possibleRows = rows.filter((r) => r.status === "POSSIBLE_MATCH")
const byId = new Map(existing.map((p) => [p.id, p]))
const looseMismatches = possibleRows.filter(
  (r) => normalizeName(r.name) !== normalizeName(byId.get(r.matchedPattern!.id)!.name),
)
ok(
  "every POSSIBLE_MATCH is name-identical to the row it matched",
  looseMismatches.length === 0,
  `${looseMismatches.length} loose`,
)
// A re-slugged product must not also be offered as NEW.
const possibleIds = new Set(possibleRows.map((r) => r.matchedPattern!.id))
ok("re-slugged rows are not also counted as NEW", !newRows.some((r) => possibleIds.has(r.matchedPattern?.id ?? -1)))

const delisted = existing.filter((p) => !listed.has(normalizeUrl(p.url)!))
console.log(`  stored rows no longer listed upstream: ${delisted.length}`)
// Most "delisted" rows are really the re-slugged ones above; only the remainder
// are genuinely gone from the store.
const trulyGone = delisted.filter((p) => !possibleIds.has(p.id))
console.log(`  of those, genuinely gone (not re-slugged): ${trulyGone.length}`)
trulyGone.forEach((p) => console.log(`     [${p.id}] ${p.name}  ${p.url}`))

console.log(`\n  sample new rows:`)
newRows.slice(0, 5).forEach((r) => console.log(`     ${r.name}  ${r.url.replace("https://www.peekaboopatternshop.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
