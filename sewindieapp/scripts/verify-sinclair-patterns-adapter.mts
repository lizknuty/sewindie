import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { comparePatterns, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterBySlug } from "../app/lib/pattern-sync/registry.ts"
import { classify } from "../app/lib/pattern-sync/adapters/sinclair-patterns.ts"

const DESIGNER_ID = 114

let passed = 0
let failed = 0
function ok(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++
    console.log(`  ok    ${label}`)
  } else {
    failed++
    console.log(`  FAIL  ${label}${detail ? `  -- ${detail}` : ""}`)
  }
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  console.log("=== classify() unit tests ===")
  const kindCases: [string, ReturnType<typeof classify>][] = [
    ["Adele knit boatneck top (PDF)", "pattern"],
    ["ADD-ON Flared skirts for Valley skater dress (PDF)", "addon"],
    ["ADD-ON Puffed Sleeves add-on pack for Bondi 22 and other compatible patterns (PDF)", "addon"],
    ["Mummy & me Valley bundle", "bundle"],
    // A pattern that merely mentions add-ons in prose must stay a pattern.
    ["Berry tee with optional add-on sleeves (PDF)", "pattern"],
  ]
  for (const [title, expected] of kindCases) {
    ok(`classify("${title.slice(0, 42)}...") = ${expected}`, classify(title) === expected, `got ${classify(title)}`)
  }

  console.log("\n=== live catalogue ===")
  const adapter = getAdapterBySlug("sinclair-patterns")
  if (!adapter) throw new Error("adapter not registered")
  const scraped = await adapter.fetchCatalogue()
  console.log(`  fetched ${scraped.length} patterns`)

  ok("fetched a plausible catalogue size (160-190)", scraped.length >= 160 && scraped.length <= 190, `${scraped.length}`)
  ok("no gift card leaked through", !scraped.some((p) => /gift card/i.test(p.name)))
  ok("all urls use the /collections/all-patterns/products/ path", scraped.every((p) => /^https:\/\/sinclairpatterns\.com\/collections\/all-patterns\/products\/[^/]+$/.test(p.url)))
  ok("every pattern has a stable sourceId", scraped.every((p) => !!p.sourceId))
  ok("unique urls", new Set(scraped.map((p) => p.url)).size === scraped.length)
  ok("releaseDate left null (migration-batch dates)", scraped.every((p) => p.releaseDate == null))

  const withImage = scraped.filter((p) => (p.imageUrl ?? "").startsWith("https://"))
  ok("nearly every product has an image (>= 165 of ~176)", withImage.length >= 165, `${withImage.length}/${scraped.length}`)
  ok("no imageUrl is a non-https string", scraped.every((p) => p.imageUrl == null || p.imageUrl.startsWith("https://")))

  const addons = scraped.filter((p) => p.kind === "addon")
  const bundles = scraped.filter((p) => p.kind === "bundle")
  console.log(`  ${addons.length} add-ons, ${bundles.length} bundles flagged`)
  ok("found the 6 add-on packs", addons.length === 6, `${addons.length}`)
  ok("found the 1 bundle", bundles.length === 1, `${bundles.length}`)

  console.log("\n=== compare against catalogue ===")
  const existing = await prisma.pattern.findMany({
    where: { designer_id: DESIGNER_ID },
    select: { id: true, name: true, url: true },
  })
  console.log(`  ${existing.length} existing catalogue rows`)

  const { summary } = comparePatterns(scraped, existing)
  console.log(`  found ${summary.found} -> existing ${summary.existing}, new ${summary.new}, possible ${summary.possibleMatches}`)

  ok("no row is counted twice", summary.new + summary.possibleMatches + summary.existing === summary.found)
  ok("all 147 existing rows matched by URL", summary.existing === existing.length, `${summary.existing}/${existing.length}`)
  ok("zero possible (fuzzy) matches -- clean URL alignment", summary.possibleMatches === 0, `${summary.possibleMatches}`)
  ok("new-pattern count is the expected ~29", summary.new >= 20 && summary.new <= 35, `${summary.new}`)

  // Spot-check that a known existing add-on row aligns by URL despite its
  // tracking-query and casing differences in the DB.
  const anAddon = existing.find((e) => /add-on flared skirts for valley skater/i.test(e.name))
  if (anAddon) {
    const norm = normalizeUrl(anAddon.url)
    ok("known add-on row matches a scraped url", scraped.some((p) => normalizeUrl(p.url) === norm))
  }

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  await prisma.$disconnect()
  await pool.end()
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
