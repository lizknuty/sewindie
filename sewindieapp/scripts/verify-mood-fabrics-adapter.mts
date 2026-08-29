import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { moodFabricsAdapter, moodSlug, classify, decodeEntities } from "../app/lib/pattern-sync/adapters/mood-fabrics"
import { getAdapterForDesigner } from "../app/lib/pattern-sync/registry"
import { comparePatterns } from "../app/lib/pattern-sync/compare"

const MOOD_DESIGNER_ID = 96
const ROUNDUP_CAT = 2655

let failures = 0
function ok(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`)
  if (!cond) failures++
}

async function main() {
  console.log("=== Mood Fabrics adapter verification ===\n")

  // --- offline: registry resolution (host split apex vs blog subdomain) --
  console.log("--- registry resolution ---")
  const resolved = getAdapterForDesigner({ url: "https://www.moodfabrics.com/" })
  ok("Mood designer (www.moodfabrics.com) resolves to mood-fabrics adapter", resolved?.slug === "mood-fabrics")
  ok(
    "importHosts allows blog.moodfabrics.com",
    (moodFabricsAdapter.importHosts ?? []).some((h) => /^blog\.moodfabrics\.com$/i.test(h)),
  )
  ok(
    "matchHosts does NOT contain blog.moodfabrics.com",
    !moodFabricsAdapter.matchHosts.some((h) => /blog\.moodfabrics/i.test(h)),
  )

  // --- offline: identity (cross-host slug reconciliation) ----------------
  console.log("\n--- identity helper ---")
  ok(
    "legacy www/blog URL and canonical blog URL share a slug",
    moodSlug("https://www.moodfabrics.com/blog/the-dreamline-baby-doll-dress-free-sewing-pattern/") ===
      moodSlug("https://blog.moodfabrics.com/the-dreamline-baby-doll-dress-free-sewing-pattern/"),
  )
  ok(
    "slug is the trailing path segment",
    moodSlug("https://blog.moodfabrics.com/the-leah-dress-free-sewing-pattern/") === "the-leah-dress-free-sewing-pattern",
  )

  // --- offline: entity decode + classification ---------------------------
  console.log("\n--- decode + classify ---")
  // &#8217; is U+2019 (right single quote), not a straight apostrophe -- decode
  // preserves it faithfully, matching what renders on the site.
  ok("decodes numeric apostrophe entity", decodeEntities("Valentine&#8217;s Day") === "Valentine\u2019s Day")
  ok("decodes &amp;", decodeEntities("Swimsuit &amp; Beach") === "Swimsuit & Beach")

  // single patterns -> "pattern"
  ok('"The <name> Free Sewing Pattern" is a pattern', classify("The Palisade Peplum Blouse Free Sewing Pattern", [1750, 1786], ROUNDUP_CAT) === "pattern")
  ok("multi-garment ensemble stays a pattern", classify("The Kalla Ensemble Free Sewing Patterns", [1750], ROUNDUP_CAT) === "pattern")
  ok("pattern + video tutorial stays a pattern", classify("The Saffron Ensemble - Free Sewing Pattern and Video Tutorial", [1750], ROUNDUP_CAT) === "pattern")
  ok("leading-quote headline still reads as a pattern", classify('"The Leah Dress" - New Free Sewing Pattern: Perfect for Parties', [1750], ROUNDUP_CAT) === "pattern")

  // non-patterns -> "other"
  ok("leading-number listicle is other", classify("22 FREE Resort Outfit Sewing Patterns for 15 Chic Looks", [1750], ROUNDUP_CAT) === "other")
  ok("pattern-roundup category is other (even if titled 'The ...')", classify("The 15-Outfit Vacation Capsule: 9 Free Patterns", [1750, ROUNDUP_CAT], ROUNDUP_CAT) === "other")
  ok('"Free X Patterns for Y" listicle is other', classify("Free Dress Patterns for Your Summer Wardrobe", [1750], ROUNDUP_CAT) === "other")
  ok('"How to ..." tutorial is other', classify("How to Create DIY Fabric Plates", [1750, 1833], ROUNDUP_CAT) === "other")
  ok('"Top N ..." listicle is other', classify("Top 5 Most Downloaded Free Sewing Patterns Right Now", [1750], ROUNDUP_CAT) === "other")
  ok("template & tutorial is other", classify("Face Mask Scarf Cold Weather Combos - Free Template & Tutorial", [1750], ROUNDUP_CAT) === "other")

  // --- live: full catalogue via WP REST API ------------------------------
  console.log("\n--- live fetch (blog.moodfabrics.com WP REST) ---")
  const started = Date.now()
  const scraped = await moodFabricsAdapter.fetchCatalogue()
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`fetched ${scraped.length} posts in ${secs}s`)

  ok("found the full category (>= 560 posts)", scraped.length >= 560)
  ok("every post has a name", scraped.every((p) => p.name.trim().length > 0))
  ok("no name exceeds 255 chars (Pattern.name limit)", scraped.every((p) => p.name.length <= 255))
  ok("every URL is on blog.moodfabrics.com", scraped.every((p) => /^https:\/\/blog\.moodfabrics\.com\//.test(p.url)))
  ok("no HTML entity leaked into any name", scraped.every((p) => !/&#?\w+;/.test(p.name)))
  ok("images (where present) are on the Mood CDN", scraped.every((p) => !p.imageUrl || /moodfabrics\.com\/wp-content/i.test(p.imageUrl)))
  ok("release dates parse as valid ISO", scraped.every((p) => !p.releaseDate || !Number.isNaN(Date.parse(p.releaseDate))))
  ok("no duplicate source ids", new Set(scraped.map((p) => p.sourceId)).size === scraped.length)

  const patterns = scraped.filter((p) => p.kind === "pattern")
  const others = scraped.filter((p) => p.kind === "other")
  const withImage = scraped.filter((p) => p.imageUrl).length
  console.log(`  kind=pattern: ${patterns.length} | kind=other (flagged): ${others.length}`)
  console.log(`  images: ${withImage}/${scraped.length}`)
  ok("a plausible number flagged as non-patterns (5-40)", others.length >= 5 && others.length <= 40)
  ok("vast majority classified as patterns (>= 540)", patterns.length >= 540)
  ok("most posts have a featured image (>= 95%)", withImage >= scraped.length * 0.95)
  console.log("  sample flagged (kind=other):")
  others.slice(0, 12).forEach((p) => console.log(`     "${p.name}"`))

  // --- live: reconcile against existing DB rows via identityKey ----------
  console.log("\n--- reconciliation vs existing DB rows ---")
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const existing = await prisma.pattern.findMany({
      where: { designer_id: MOOD_DESIGNER_ID },
      select: { id: true, name: true, url: true },
    })
    console.log(`existing Mood rows in DB: ${existing.length}`)

    const { rows, summary } = comparePatterns(
      scraped,
      existing.map((e) => ({ id: e.id, name: e.name, url: e.url })),
      { identityKey: moodFabricsAdapter.identityKey },
    )
    console.log(`  NEW: ${summary.new}`)
    console.log(`  EXISTING (matched): ${summary.existing}`)
    console.log(`  POSSIBLE_MATCH: ${summary.possibleMatches}`)

    // The one existing row (a legacy www/blog URL) must reconcile by slug
    // against the canonical blog-subdomain URL rather than showing up as NEW.
    if (existing.length > 0) {
      ok("existing row(s) reconcile by slug (none left unmatched as NEW)", summary.existing === existing.length)
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
