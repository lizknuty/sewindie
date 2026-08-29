import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { oliverAndSAdapter } from "../app/lib/pattern-sync/adapters/oliver-and-s"
import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import { comparePatterns } from "../app/lib/pattern-sync/compare"

const OLIVER_DESIGNER_ID = 101

let failures = 0
function ok(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`)
  if (!cond) failures++
}

async function main() {
  console.log("=== Oliver + S adapter verification ===\n")

  // --- offline: registry resolution (the shared-store hazard) ------------
  console.log("--- registry resolution ---")
  const oliverAdapter = getAdapterForDesigner({ url: "https://oliverands.com/" })
  ok("Oliver + S designer (oliverands.com) resolves to oliver-and-s adapter", oliverAdapter?.slug === "oliver-and-s")

  // The mirror of the Liesl guard: the Liesl designer must still resolve to the
  // Liesl adapter, not get swallowed by this one.
  const lieslAdapter = getAdapterForDesigner({ url: "https://www.lieslandco.com/" })
  ok("Liesl designer (lieslandco.com) does NOT resolve to oliver-and-s", lieslAdapter?.slug !== "oliver-and-s")
  ok("matchHosts covers oliverands.com (designer + import)", oliverAndSAdapter.matchHosts.some((h) => /oliverands\.com/i.test(h)))
  ok("no importHosts override needed (falls back to matchHosts)", oliverAndSAdapter.importHosts === undefined)

  // --- live: full catalogue crawl ----------------------------------------
  console.log("\n--- live crawl (oliverands.com, brand-filtered) ---")
  const started = Date.now()
  const scraped = await oliverAndSAdapter.fetchCatalogue()
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`fetched ${scraped.length} Oliver + S products in ${secs}s`)

  ok("found a plausible number of patterns (65-95)", scraped.length >= 65 && scraped.length <= 95)
  ok("every pattern has a name", scraped.every((p) => p.name.trim().length > 0))
  ok("every pattern URL is on oliverands.com/shop/", scraped.every((p) => /^https:\/\/oliverands\.com\/shop\/[^/]+\.html$/.test(p.url)))
  ok("no title-suffix leaked into any name", scraped.every((p) => !/\|\s*(Shop|Oliver)/i.test(p.name)))
  ok("images (where present) are on o.osimg.net", scraped.every((p) => !p.imageUrl || /o\.osimg\.net/i.test(p.imageUrl)))
  ok("release dates are null (no trustworthy source)", scraped.every((p) => p.releaseDate == null))
  ok("no duplicate slugs", new Set(scraped.map((p) => p.sourceId)).size === scraped.length)

  // The bug this refactor fixed: every image must belong to its OWN product's
  // SKU folder, never a related-products carousel entry. The slug and the image
  // SKU won't be string-equal, but each image URL must be unique per product.
  const imaged = scraped.filter((p) => p.imageUrl)
  const uniqueImages = new Set(imaged.map((p) => p.imageUrl)).size
  ok("no two products share an image (SKU-scoped, no carousel leakage)", uniqueImages === imaged.length)

  const withImage = imaged.length
  console.log(`  images: ${withImage}/${scraped.length} (all unique: ${uniqueImages === imaged.length})`)
  const bundles = scraped.filter((p) => p.kind === "bundle")
  console.log(`  bundles: ${bundles.length}${bundles.length ? ` (${bundles.map((b) => b.name).join(", ")})` : ""}`)

  // --- live: reconcile against existing DB rows via identityKey ----------
  console.log("\n--- reconciliation vs existing DB rows ---")
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const existing = await prisma.pattern.findMany({
      where: { designer_id: OLIVER_DESIGNER_ID },
      select: { id: true, name: true, url: true },
    })
    console.log(`existing Oliver + S rows in DB: ${existing.length}`)

    const { rows, summary } = comparePatterns(
      scraped,
      existing.map((e) => ({ id: e.id, name: e.name, url: e.url })),
      { identityKey: oliverAndSAdapter.identityKey },
    )
    console.log(`  NEW: ${summary.new}`)
    console.log(`  EXISTING (matched): ${summary.existing}`)
    console.log(`  POSSIBLE_MATCH: ${summary.possibleMatches}`)

    // 78 of the 79 existing rows are Oliver-branded on the store (the 79th, the
    // family pack, is attributed to Liesl + Co), so nearly all should match.
    ok("majority of existing rows matched by slug (>= 70)", summary.existing >= 70)

    const newRows = rows.filter((r) => r.status === "NEW")
    const possible = rows.filter((r) => r.status === "POSSIBLE_MATCH")
    if (newRows.length) {
      console.log("  sample NEW:")
      newRows.slice(0, 10).forEach((p) => console.log(`     "${p.name}"  ${p.url}`))
    }
    if (possible.length) {
      console.log("  sample POSSIBLE_MATCH:")
      possible.slice(0, 8).forEach((m) => console.log(`     "${m.name}" ~ "${m.matchedPattern?.name}"`))
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }

  console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`} ===`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
