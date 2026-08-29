// End-to-end check of the Ottobre Design adapter against the live store and
// the real (currently empty) catalogue, exercising the actual adapter,
// registry and comparePatterns rather than reimplementing any of it. Like
// Atelier Brunette this is a fresh backfill with NO existing rows, so it leans
// on OFFLINE UNIT TESTS of the risky pure function (product_type + vendor
// filtering, suffix stripping) plus structural assertions about the 7 rows.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-ottobre-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { extractEPatterns, type ShopifyProduct } from "../app/lib/pattern-sync/adapters/ottobre.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- offline unit tests: extractEPatterns ---------------------------------
// Synthetic products so the filtering + suffix logic is pinned down regardless
// of what the live store holds today.
console.log("=== unit: extractEPatterns ===")
const fixture: ShopifyProduct[] = [
  // kept: e-patterns from OTTOBRE, with the 3 suffix variants seen in the wild
  { id: 1, title: "RACHEL knit dress, e-pattern", handle: "rachel", vendor: "OTTOBRE design®", product_type: "E-pattern", images: [{ src: "https://img/1.jpg" }] }, // comma + " e-pattern"
  { id: 2, title: "Merino Wool Beanie e-pattern", handle: "beanie", vendor: "OTTOBRE design®", product_type: "E-pattern", images: [{ src: "https://img/2.jpg" }] }, // no comma
  { id: 3, title: "Girls' panties and boyshorts e-pattern", handle: "panties", vendor: "OTTOBRE design®", product_type: "E-pattern", images: [{ src: "https://img/3.jpg" }] },
  // dropped: not an e-pattern
  { id: 4, title: "Spring 1/2014, kids, single issue", handle: "spring-2014", vendor: "OTTOBRE design®", product_type: "Magazine", images: [{ src: "https://img/4.jpg" }] }, // print magazine -> dropped (decision 1)
  { id: 5, title: "Winter e-issue", handle: "winter-eissue", vendor: "OTTOBRE design®", product_type: "E-magazine", images: [{ src: "https://img/5.jpg" }] }, // e-magazine -> dropped
  // dropped: e-pattern-looking product_type but wrong vendor (yarn resellers)
  { id: 6, title: "Katia Merino something e-pattern", handle: "katia", vendor: "Katia", product_type: "E-pattern", images: [{ src: "https://img/6.jpg" }] },
]
const extracted = extractEPatterns(fixture)
ok("extracts exactly the 3 OTTOBRE e-patterns", extracted.length === 3, `got ${extracted.length}`)
ok("print Magazine is dropped", !extracted.some((p) => p.sourceId === "4"))
ok("E-magazine is dropped", !extracted.some((p) => p.sourceId === "5"))
ok("non-OTTOBRE vendor is dropped even if E-pattern", !extracted.some((p) => p.sourceId === "6"))
ok('", e-pattern" suffix + comma stripped', extracted.find((p) => p.sourceId === "1")?.name === "RACHEL knit dress")
ok('" e-pattern" suffix (no comma) stripped', extracted.find((p) => p.sourceId === "2")?.name === "Merino Wool Beanie")
ok("brand caps preserved (RACHEL)", extracted.find((p) => p.sourceId === "1")?.name.startsWith("RACHEL"))
ok("apostrophe design name intact", extracted.find((p) => p.sourceId === "3")?.name === "Girls' panties and boyshorts")
ok("URL is bare /products/<handle>", extracted.find((p) => p.sourceId === "1")?.url === "https://www.ottobredesign.com/products/rachel")
ok("image mapped", extracted.find((p) => p.sourceId === "1")?.imageUrl === "https://img/1.jpg")
ok("release date null", extracted.every((p) => p.releaseDate == null))
ok("all kind 'pattern'", extracted.every((p) => p.kind === "pattern"))

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Ottobre", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL", adapter?.slug === "ottobre", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("ottobre") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("ottobre")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is the expected 7 e-patterns", scraped.length === 7, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual e-pattern suffix on any name", !scraped.some((p) => /e[-\s]?pattern\s*$/i.test(p.name)))
ok("every URL is the bare /products/ shape", scraped.every((p) => /^https:\/\/www\.ottobredesign\.com\/products\/[^/]+$/.test(p.url)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("release dates all null (Shopify migration timestamps)", scraped.every((p) => p.releaseDate == null))
ok("no print magazine leaked in (no 'single issue' name)", !scraped.some((p) => /single issue|magazine/i.test(p.name)))

// Every live URL must actually resolve 200 (not 302-to-home like the magazines).
console.log("\n=== live URL resolution (the whole point of e-patterns-only) ===")
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
let resolved = 0
for (const p of scraped) {
  try {
    const r = await fetch(p.url, { headers: { "User-Agent": UA }, redirect: "manual", signal: AbortSignal.timeout(15_000) })
    if (r.status === 200) resolved++
    else console.log(`     non-200 (${r.status}): ${p.url}`)
  } catch (e) {
    console.log(`     error fetching ${p.url}: ${(e as Error).message}`)
  }
}
ok("all 7 e-pattern URLs resolve 200", resolved === scraped.length, `${resolved}/${scraped.length}`)

// --- comparison against the real (empty) catalogue ------------------------
console.log("\n=== compare vs catalogue ===")
const existing = await prisma.pattern.findMany({
  where: { designer_id: designer!.id },
  select: { id: true, name: true, url: true },
})
const { rows, summary } = comparePatterns(scraped, existing)
console.log(`  in catalogue: ${existing.length}`)
console.log(`  found ${summary.found} -> new ${summary.new}, possible ${summary.possibleMatches}, existing ${summary.existing}`)
ok("catalogue is empty as expected (fresh backfill)", existing.length === 0, `existing ${existing.length}`)
ok("every scraped pattern is NEW", summary.new === scraped.length, `new ${summary.new}/${scraped.length}`)
ok("no possible-match fuzz", summary.possibleMatches === 0, `possible ${summary.possibleMatches}`)
ok("nothing matched an existing row", summary.existing === 0, `existing ${summary.existing}`)
ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)
ok("NEW rows have unique normalized URLs", new Set(rows.map((r) => normalizeUrl(r.url))).size === rows.length)

console.log(`\n  rows to be imported:`)
scraped.forEach((p) => console.log(`     [${p.kind}] ${p.name}  <-  ${p.url.replace("https://www.ottobredesign.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
