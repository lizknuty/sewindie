import { readFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { grasserSlug } from "../app/lib/pattern-sync/adapters/grasser"
import { extractGrasserMetadata } from "../app/lib/pattern-sync/metadata/grasser"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"

// One-time backfill of Grasser metadata across the existing catalogue.
//
// Category + audience are derived from the pattern NAME (already in the DB);
// difficulty comes from the per-product detail pages, which were crawled once
// into scripts/tmp-grasser-cache.json (slug -> { category, difficulty }). We
// match each DB pattern to its cache entry by the stable trailing slug, run the
// shared extractor, and apply additively via the shared writer.
//
// Dry-run by default. Set EXECUTE=1 to commit.

const EXECUTE = process.env.EXECUTE === "1"
const CACHE = "scripts/tmp-grasser-cache.json"
const DESIGNER = "Grasser"

type Detail = { url: string; slug: string | null; category: string | null; difficulty: number | null }

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const cache = JSON.parse(readFileSync(CACHE, "utf8")) as Detail[]
  const bySlug = new Map<string, Detail>()
  for (const d of cache) {
    if (d.slug) bySlug.set(d.slug, d)
  }
  console.log(`cache: ${cache.length} details, ${bySlug.size} keyed by slug`)

  const designer = await prisma.designer.findFirst({ where: { name: DESIGNER }, select: { id: true, name: true } })
  if (!designer) throw new Error(`Designer "${DESIGNER}" not found`)

  const patterns = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: { id: true, name: true, url: true },
  })
  console.log(`designer ${designer.name} (id ${designer.id}): ${patterns.length} patterns`)

  const vocab = await loadVocab(prisma)

  let matched = 0
  let noCache = 0
  let enriched = 0
  const totals = { audience: 0, category: 0, difficulty: 0 }
  const vocabMissing = new Map<string, { dimension: string; name: string }>()
  const unmatchedTerms = new Map<string, number>()

  for (const p of patterns) {
    const slug = grasserSlug(p.url)
    const detail = slug ? bySlug.get(slug) : undefined
    if (!detail) {
      noCache++
      // Even without a detail entry we can still enrich from the name alone.
    } else {
      matched++
    }

    const meta = extractGrasserMetadata({
      name: p.name,
      categoryPath: detail?.category ?? null,
      difficulty: detail?.difficulty ?? null,
    })

    for (const u of meta.unmatched) {
      unmatchedTerms.set(u.term, (unmatchedTerms.get(u.term) ?? 0) + 1)
    }

    const plan = await applyMetadata(prisma, p.id, meta, vocab, EXECUTE)
    const added = plan.toAdd.audience.length + plan.toAdd.category.length + (plan.difficultySet ? 1 : 0)
    if (added > 0) enriched++
    totals.audience += plan.toAdd.audience.length
    totals.category += plan.toAdd.category.length
    if (plan.difficultySet) totals.difficulty += 1
    for (const miss of plan.vocabMissing) vocabMissing.set(`${miss.dimension}:${miss.name}`, miss)
  }

  console.log(`\n${EXECUTE ? "EXECUTED" : "DRY RUN"} -----------------------------`)
  console.log(`matched to cache: ${matched}, no cache entry: ${noCache}`)
  console.log(`patterns enriched: ${enriched}`)
  console.log(`links/values to add: audience ${totals.audience}, category ${totals.category}, difficulty ${totals.difficulty}`)

  if (vocabMissing.size > 0) {
    console.log(`\nVOCAB MISSING (${vocabMissing.size}):`)
    for (const m of vocabMissing.values()) console.log(`  ${m.dimension}: ${m.name}`)
  } else {
    console.log(`\nVOCAB MISSING: none`)
  }

  if (unmatchedTerms.size > 0) {
    console.log(`\nUNMATCHED names (${unmatchedTerms.size} distinct), top 40:`)
    for (const [term, n] of [...unmatchedTerms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
      console.log(`  x${n}  ${term}`)
    }
  } else {
    console.log(`\nUNMATCHED names: none`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
