import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { lieslAndCoAdapter } from "../app/lib/pattern-sync/adapters/liesl-and-co"
import {
  oliverandsSlug,
  extractName,
  extractImage,
  classifyProduct,
} from "../app/lib/pattern-sync/adapters/oliverands-store"
import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import { comparePatterns } from "../app/lib/pattern-sync/compare"

const LIESL_DESIGNER_ID = 78

let failures = 0
function ok(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`)
  if (!cond) failures++
}

async function main() {
  console.log("=== Liesl + Co adapter verification ===\n")

  // --- offline: registry resolution (the shared-store hazard) ------------
  console.log("--- registry resolution ---")
  const lieslAdapter = getAdapterForDesigner({ url: "https://www.lieslandco.com/" })
  ok("Liesl designer (lieslandco.com) resolves to liesl-and-co adapter", lieslAdapter?.slug === "liesl-and-co")

  // The critical guard: the separate Oliver + S designer must NOT be hijacked
  // by this adapter just because Liesl's patterns live on oliverands.com.
  const oliverAdapter = getAdapterForDesigner({ url: "https://oliverands.com/" })
  ok("Oliver + S designer (oliverands.com) does NOT resolve to liesl-and-co", oliverAdapter?.slug !== "liesl-and-co")
  ok("importHosts allows oliverands.com", (lieslAndCoAdapter.importHosts ?? []).some((h) => /oliverands\.com/i.test(h)))
  ok("matchHosts does NOT contain oliverands.com", !lieslAndCoAdapter.matchHosts.some((h) => /oliverands/i.test(h)))

  // --- offline: shared oliverands-store parsing helpers ------------------
  console.log("\n--- parsing helpers (shared oliverands-store) ---")
  ok("slug strips .html and path", oliverandsSlug("https://oliverands.com/shop/bistro-dress-sewing-pattern.html") === "bistro-dress-sewing-pattern")
  ok("slug keeps digital- prefix (distinct product)", oliverandsSlug("https://oliverands.com/shop/digital-bistro-dress-sewing-pattern.html") === "digital-bistro-dress-sewing-pattern")
  ok(
    "name strips ' | Shop | Oliver + S' suffix",
    extractName("<title>Digital Bistro Dress Sewing Pattern | Shop | Oliver + S</title>") ===
      "Digital Bistro Dress Sewing Pattern",
  )
  ok(
    "image prefers _Garment and absolutises protocol-relative URL",
    extractImage(
      "var dataLayer=[{item_id:'L123'}];" +
        '<img src="//o.osimg.net/images/product/L123/L123_Dressed.jpg"><img src="//o.osimg.net/images/product/L123/L123_Garment.jpg">',
    ) === "https://o.osimg.net/images/product/L123/L123_Garment.jpg",
  )
  // The core cross-contamination guard: a related-products image (different SKU)
  // must be ignored in favour of the page's own SKU image.
  ok(
    "image is scoped to the page's own SKU (ignores related-products carousel)",
    extractImage(
      "var dataLayer=[{item_id:'OLV-OS004SS'}];" +
        '<img src="//o.osimg.net/images/product/OLV-OS004SS/OLV-OS004SS_Dressed.jpg">' +
        '<a href="//o.osimg.net/images/product/OLV-OS001TP/OLV-OS001TP_Garment.jpg"></a>',
    ) === "https://o.osimg.net/images/product/OLV-OS004SS/OLV-OS004SS_Dressed.jpg",
  )
  ok("image is null when the page has no SKU", extractImage('<img src="//o.osimg.net/images/product/L1/L1_thumb.jpg">') === null)
  ok("family pack classified as bundle", classifyProduct("Metro + School Bus Family Pack Sewing Patterns") === "bundle")
  ok("standard pattern classified as pattern", classifyProduct("Bistro Dress Sewing Pattern") === "pattern")

  // --- live: full catalogue crawl ----------------------------------------
  console.log("\n--- live crawl (oliverands.com, brand-filtered) ---")
  const started = Date.now()
  const scraped = await lieslAndCoAdapter.fetchCatalogue()
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`fetched ${scraped.length} Liesl + Co products in ${secs}s`)

  ok("found a plausible number of patterns (85-120)", scraped.length >= 85 && scraped.length <= 120)
  ok("every pattern has a name", scraped.every((p) => p.name.trim().length > 0))
  ok("every pattern URL is on oliverands.com/shop/", scraped.every((p) => /^https:\/\/oliverands\.com\/shop\/[^/]+\.html$/.test(p.url)))
  ok("no title-suffix leaked into any name", scraped.every((p) => !/\|\s*(Shop|Oliver)/i.test(p.name)))
  ok("images (where present) are on o.osimg.net", scraped.every((p) => !p.imageUrl || /o\.osimg\.net/i.test(p.imageUrl)))
  ok("release dates are null (no trustworthy source)", scraped.every((p) => p.releaseDate == null))
  ok("no duplicate slugs", new Set(scraped.map((p) => p.sourceId)).size === scraped.length)

  const withImage = scraped.filter((p) => p.imageUrl).length
  console.log(`  images: ${withImage}/${scraped.length}`)
  const bundles = scraped.filter((p) => p.kind === "bundle")
  console.log(`  bundles: ${bundles.length}${bundles.length ? ` (${bundles.map((b) => b.name).join(", ")})` : ""}`)

  // --- live: reconcile against existing DB rows via identityKey ----------
  console.log("\n--- reconciliation vs existing DB rows ---")
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const existing = await prisma.pattern.findMany({
      where: { designer_id: LIESL_DESIGNER_ID },
      select: { id: true, name: true, url: true },
    })
    console.log(`existing Liesl rows in DB: ${existing.length}`)

    const { rows, summary } = comparePatterns(
      scraped,
      existing.map((e) => ({ id: e.id, name: e.name, url: e.url })),
      { identityKey: lieslAndCoAdapter.identityKey },
    )
    console.log(`  NEW: ${summary.new}`)
    console.log(`  EXISTING (matched): ${summary.existing}`)
    console.log(`  POSSIBLE_MATCH: ${summary.possibleMatches}`)

    // With 95 existing rows and a ~96-product catalogue, the vast majority
    // should reconcile cleanly by slug.
    ok("majority of existing rows matched by slug (>= 80)", summary.existing >= 80)

    const newRows = rows.filter((r) => r.status === "NEW")
    const possible = rows.filter((r) => r.status === "POSSIBLE_MATCH")
    if (newRows.length) {
      console.log("  sample NEW:")
      newRows.slice(0, 8).forEach((p) => console.log(`     "${p.name}"  ${p.url}`))
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
