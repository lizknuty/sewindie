import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { moodFabricsAdapter, moodSlug } from "../app/lib/pattern-sync/adapters/mood-fabrics"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"
import { hasMetadata } from "../app/lib/pattern-sync/metadata/types"
import type { MetadataDimension } from "../app/lib/pattern-sync/metadata/types"

const EXECUTE = process.env.EXECUTE === "1"
const DESIGNER_ID = 96 // Mood Sewciety

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log(`\n=== Mood Sewciety metadata backfill (${EXECUTE ? "EXECUTE" : "DRY RUN"}) ===\n`)

  // 1. Scrape the live catalogue (metadata attached by the adapter).
  const scraped = await moodFabricsAdapter.fetchCatalogue()
  const patterns = scraped.filter((s) => s.kind === "pattern" && s.metadata && hasMetadata(s.metadata))
  console.log(`Scraped ${scraped.length} posts; ${patterns.length} single patterns with metadata.`)

  // 2. Index DB patterns by identity slug.
  const dbRows = await prisma.pattern.findMany({
    where: { designer_id: DESIGNER_ID },
    select: { id: true, url: true, name: true },
  })
  const bySlug = new Map<string, { id: number; name: string }>()
  for (const r of dbRows) {
    const key = moodSlug(r.url)
    if (key) bySlug.set(key, { id: r.id, name: r.name })
  }
  console.log(`Loaded ${dbRows.length} DB patterns for designer ${DESIGNER_ID}.\n`)

  const vocab = await loadVocab(prisma)

  // 3. Plan / apply per matched pattern.
  const added: Record<MetadataDimension, number> = {
    audience: 0,
    category: 0,
    fabricType: 0,
    attribute: 0,
    suggestedFabric: 0,
  }
  let difficultySetCount = 0
  let matched = 0
  let enriched = 0
  const unmatchedPatterns: string[] = []
  const vocabMissing = new Map<string, number>()
  const unmatchedTerms = new Map<string, number>()

  for (const p of patterns) {
    const key = moodSlug(p.url)
    const row = key ? bySlug.get(key) : undefined
    if (!row) {
      unmatchedPatterns.push(p.name)
      continue
    }
    matched++

    for (const u of p.metadata!.unmatched) {
      const k = `${u.dimension}: ${u.term}`
      unmatchedTerms.set(k, (unmatchedTerms.get(k) ?? 0) + 1)
    }

    const plan = await applyMetadata(prisma, row.id, p.metadata!, vocab, EXECUTE)

    let touched = false
    for (const dim of Object.keys(added) as MetadataDimension[]) {
      const n = plan.toAdd[dim].length
      added[dim] += n
      if (n > 0) touched = true
    }
    if (plan.difficultySet) {
      difficultySetCount++
      touched = true
    }
    if (touched) enriched++

    for (const m of plan.vocabMissing) {
      const k = `${m.dimension}: ${m.name}`
      vocabMissing.set(k, (vocabMissing.get(k) ?? 0) + 1)
    }
  }

  // 4. Report.
  console.log(`Matched ${matched}/${patterns.length} patterns to DB rows; ${enriched} enriched.\n`)
  console.log("Links to add (or added) by dimension:")
  for (const [dim, n] of Object.entries(added)) console.log(`  ${dim}: ${n}`)
  console.log(`  difficulty (scalar set): ${difficultySetCount}`)
  const total = Object.values(added).reduce((a, b) => a + b, 0)
  console.log(`  TOTAL links: ${total}\n`)

  if (vocabMissing.size) {
    console.log("Vocab MISSING (mapped but no DB row -- candidates):")
    for (const [k, n] of [...vocabMissing.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}  x${n}`)
    }
    console.log("")
  } else {
    console.log("Vocab missing: none.\n")
  }

  if (unmatchedTerms.size) {
    console.log("Top UNMATCHED source terms (reported, not mapped):")
    for (const [k, n] of [...unmatchedTerms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`  ${k}  x${n}`)
    }
    console.log("")
  }

  if (unmatchedPatterns.length) {
    console.log(`Patterns not matched to a DB row: ${unmatchedPatterns.length}`)
    for (const n of unmatchedPatterns.slice(0, 15)) console.log(`  - ${n}`)
    if (unmatchedPatterns.length > 15) console.log(`  ... and ${unmatchedPatterns.length - 15} more`)
  }

  console.log(`\n=== ${EXECUTE ? "EXECUTED" : "DRY RUN complete -- re-run with EXECUTE=1 to apply"} ===`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
