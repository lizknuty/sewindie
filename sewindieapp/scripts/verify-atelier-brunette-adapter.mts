// End-to-end check of the Atelier Brunette adapter against the live store and
// the real (currently empty) catalogue, exercising the actual adapter,
// registry and comparePatterns rather than reimplementing any of it. Because
// this designer has NO existing rows, the URL-alignment checks other adapters
// rely on cannot apply -- so this script leans harder on OFFLINE UNIT TESTS of
// the two risky pure functions (suffix stripping + paper/PDF collapse) and on
// structural assertions about the 51 fresh rows.
//
//   set -a && source /vercel/share/.env.project && set +a \
//     && node --import ./scripts/ts-resolve-hook.mjs scripts/verify-atelier-brunette-adapter.mts

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterForDesigner, getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import {
  extractPatternProducts,
  collapseByDesign,
  type ShopifyProduct,
} from "../app/lib/pattern-sync/adapters/atelier-brunette.ts"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

let failures = 0
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures++
  console.log(`${condition ? "  ok  " : "FAIL  "}${label}${detail ? ` -- ${detail}` : ""}`)
}

// --- offline unit tests: extract + collapse -------------------------------
// These use synthetic products so the tricky logic is pinned down independent
// of whatever the live store happens to hold today.
console.log("=== unit: extractPatternProducts ===")
const fixture: ShopifyProduct[] = [
  { id: 1, title: "LE Sweat - PDF Sewing Pattern", handle: "le-sweat", images: [{ src: "https://img/1.jpg" }] },
  { id: 2, title: "Le Sweat - Paper Sewing Pattern", handle: "le-sweat-paper", images: [{ src: "https://img/2.jpg" }] },
  { id: 3, title: "LA Robe Butterfly – PDF sewing pattern", handle: "robe-butterfly-pdf", images: [{ src: "https://img/3.jpg" }] }, // en-dash + lowercase suffix
  { id: 4, title: "LA COMBI ADDIE - Paper Sewing Pattern", handle: "combi-addie-paper", images: [{ src: "https://img/4.jpg" }] }, // paper-only
  { id: 5, title: "Crepe Fabric - Night Blue", handle: "crepe-night-blue", images: [{ src: "https://img/5.jpg" }] }, // fabric, dropped
  { id: 6, title: "Milward Gridded Pattern Paper", handle: "gridded-pattern-paper", images: [] }, // "pattern paper" but not the suffix, dropped
  { id: 7, title: "THE Pattern Collection", handle: "the-pattern-collection", images: [] }, // landing page, dropped
  { id: 8, title: "PDF Knitting Kit", handle: "pdf-knitting-kit", images: [] }, // knitting kit, dropped
]
const extracted = extractPatternProducts(fixture)
ok("extracts exactly the 4 pattern products", extracted.length === 4, `got ${extracted.length}`)
ok("fabric is dropped", !extracted.some((p) => p.handle === "crepe-night-blue"))
ok('"Gridded Pattern Paper" (no suffix) is dropped', !extracted.some((p) => p.handle === "gridded-pattern-paper"))
ok('"THE Pattern Collection" landing page is dropped', !extracted.some((p) => p.handle === "the-pattern-collection"))
ok('"PDF Knitting Kit" is dropped', !extracted.some((p) => p.handle === "pdf-knitting-kit"))
ok("suffix stripped from design name", extracted.find((p) => p.handle === "le-sweat")?.design === "LE Sweat")
ok("brand casing preserved (LA COMBI ADDIE)", extracted.find((p) => p.handle === "combi-addie-paper")?.design === "LA COMBI ADDIE")
ok("en-dash + lowercase 'sewing pattern' suffix stripped", extracted.find((p) => p.handle === "robe-butterfly-pdf")?.design === "LA Robe Butterfly")
ok("format decoded: pdf", extracted.find((p) => p.handle === "le-sweat")?.format === "pdf")
ok("format decoded: paper", extracted.find((p) => p.handle === "le-sweat-paper")?.format === "paper")

console.log("\n=== unit: collapseByDesign (prefer PDF) ===")
const collapsed = collapseByDesign(extracted)
ok("4 products collapse to 3 designs", collapsed.length === 3, `got ${collapsed.length}`)
const sweat = collapsed.find((p) => p.name === "LE Sweat")
ok('paired design keeps ONE row', collapsed.filter((p) => p.name.toLowerCase() === "le sweat").length === 1)
ok('paired design is canonicalised to the PDF handle', sweat?.url === "https://www.atelierbrunette.com/products/le-sweat", `got ${sweat?.url}`)
ok('paired design uses the PDF image', sweat?.imageUrl === "https://img/1.jpg", `got ${sweat?.imageUrl}`)
const addie = collapsed.find((p) => p.name === "LA COMBI ADDIE")
ok("paper-only design falls back to paper handle", addie?.url === "https://www.atelierbrunette.com/products/combi-addie-paper", `got ${addie?.url}`)
ok("all collapsed rows are kind 'pattern'", collapsed.every((p) => p.kind === "pattern"))
// order-independence: paper first must still prefer the PDF
const swapped = collapseByDesign([extracted[1], extracted[0]]) // paper before pdf
ok("prefers PDF regardless of input order", swapped[0]?.url.endsWith("/le-sweat"), `got ${swapped[0]?.url}`)

// --- registry wiring -------------------------------------------------------
console.log("\n=== registry ===")
const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Brunette", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
ok("designer row found", Boolean(designer), designer ? `#${designer.id} ${designer.name} -- ${designer.url}` : "")
const adapter = designer ? getAdapterForDesigner(designer) : null
ok("resolves via designer URL (the /en homepage)", adapter?.slug === "atelier-brunette", `got ${adapter?.slug ?? "null"}`)
ok("resolves by slug", getAdapterBySlug("atelier-brunette") !== null)

// --- live catalogue --------------------------------------------------------
console.log("\n=== live fetch ===")
const started = Date.now()
const scraped = await getAdapterBySlug("atelier-brunette")!.fetchCatalogue()
const secs = (Date.now() - started) / 1000
console.log(`  fetched ${scraped.length} patterns in ${secs.toFixed(1)}s`)
ok("completes inside the 60s route budget", secs < 55, `${secs.toFixed(1)}s`)
ok("catalogue is in the expected 45-60 band (51 designs today)", scraped.length >= 45 && scraped.length <= 60, `got ${scraped.length}`)
ok("every product has a name", scraped.every((p) => p.name.trim().length > 0))
ok("no name exceeds the 255-char column", scraped.every((p) => p.name.length <= 255))
ok("no residual format suffix on any name", !scraped.some((p) => /(pdf|paper)\s*(sewing\s*)?pattern\s*$/i.test(p.name)))
ok("every URL is the bare /products/ shape", scraped.every((p) => /^https:\/\/www\.atelierbrunette\.com\/products\/[^/]+$/.test(p.url)))
ok("no URL carries an /en/ or /collections/ prefix", !scraped.some((p) => /\/en\/|\/collections\//.test(p.url)))
ok("every product has an image", scraped.every((p) => (p.imageUrl ?? "").startsWith("https://")))
ok("every product has a source id", scraped.every((p) => Boolean(p.sourceId)))
ok("URLs are unique (paper/PDF collapsed)", new Set(scraped.map((p) => p.url)).size === scraped.length)
ok("design names are unique (no dup designs)", new Set(scraped.map((p) => p.name.toLowerCase())).size === scraped.length)
ok("release dates all null (Shopify migration timestamps)", scraped.every((p) => p.releaseDate == null))
ok("brand article casing survives (some 'LE '/'LA '/'L'' name)", scraped.some((p) => /^(LE |LA |L['’])/.test(p.name)))

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

console.log(`\n  sample rows to be imported:`)
scraped.slice(0, 12).forEach((p) => console.log(`     [${p.kind}] ${p.name}  <-  ${p.url.replace("https://www.atelierbrunette.com", "")}`))

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
await prisma.$disconnect()
await pool.end()
process.exit(failures === 0 ? 0 : 1)
