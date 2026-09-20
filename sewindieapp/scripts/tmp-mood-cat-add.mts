import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { moodFabricsAdapter } from "../app/lib/pattern-sync/adapters/mood-fabrics"
import { loadVocab, applyMetadata } from "../app/lib/pattern-sync/metadata/writer"
import type { MetadataDimension } from "../app/lib/pattern-sync/metadata/types"

const EXECUTE = process.env.EXECUTE === "1"
const DESIGNER_ID = 96 // Mood Sewciety
const NEW_CATEGORIES = ["Adaptive", "Activewear", "Suiting"]

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function ensureCategories() {
  for (const name of NEW_CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { name } })
    if (existing) {
      console.log(`  category "${name}" already exists (id ${existing.id})`)
      continue
    }
    if (!EXECUTE) {
      console.log(`  [dry-run] would create category "${name}"`)
      continue
    }
    const row = await prisma.category.create({ data: { name } })
    console.log(`  created category "${name}" (id ${row.id})`)
  }
}

async function main() {
  console.log(`\n=== Mood category add + re-enrich (${EXECUTE ? "EXECUTE" : "dry-run"}) ===\n`)

  console.log("Ensuring new category rows:")
  await ensureCategories()

  // Load vocab AFTER creating rows so the new categories resolve.
  const vocab = await loadVocab(prisma)

  console.log("\nFetching Mood catalogue...")
  const scraped = await moodFabricsAdapter.fetchCatalogue()
  const patterns = scraped.filter((p) => p.kind === "pattern" && p.metadata)
  console.log(`  ${scraped.length} scraped, ${patterns.length} single patterns with metadata`)

  // DB Mood patterns keyed by identity slug.
  const dbRows = await prisma.pattern.findMany({
    where: { designer_id: DESIGNER_ID },
    select: { id: true, url: true },
  })
  const byIdentity = new Map<string, number>()
  for (const r of dbRows) {
    const key = moodFabricsAdapter.identityKey(r.url)
    if (key) byIdentity.set(key, r.id)
  }
  console.log(`  ${dbRows.length} Mood patterns in DB`)

  const totals: Record<MetadataDimension, number> = {
    audience: 0,
    category: 0,
    fabricType: 0,
    attribute: 0,
    suggestedFabric: 0,
  }
  let difficultySet = 0
  let matched = 0
  let enriched = 0
  let unmatched = 0
  const vocabMissing = new Map<string, number>()
  const catAdds = new Map<string, number>()

  for (const p of patterns) {
    const key = moodFabricsAdapter.identityKey(p.url)
    const patternId = key ? byIdentity.get(key) : undefined
    if (!patternId) {
      unmatched++
      continue
    }
    matched++
    const plan = await applyMetadata(prisma, patternId, p.metadata!, vocab, EXECUTE)
    let touched = false
    for (const dim of Object.keys(totals) as MetadataDimension[]) {
      const adds = plan.toAdd[dim]
      totals[dim] += adds.length
      if (adds.length) touched = true
      if (dim === "category") for (const n of adds) catAdds.set(n, (catAdds.get(n) ?? 0) + 1)
    }
    if (plan.difficultySet) {
      difficultySet++
      touched = true
    }
    if (touched) enriched++
    for (const m of plan.vocabMissing) {
      const k = `${m.dimension}:${m.name}`
      vocabMissing.set(k, (vocabMissing.get(k) ?? 0) + 1)
    }
  }

  console.log(`\n--- Result ---`)
  console.log(`matched ${matched}, enriched ${enriched}, unmatched ${unmatched}`)
  console.log(`links to add:`, totals)
  console.log(`difficulty set: ${difficultySet}`)
  console.log(`\ncategory adds by name:`)
  for (const [n, c] of [...catAdds.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${c}`)
  if (vocabMissing.size) {
    console.log(`\nvocab still missing (reported, not created):`)
    for (const [k, c] of [...vocabMissing.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}\t${c}`)
  } else {
    console.log(`\nvocab missing: none`)
  }

  await pool.end()
}

main().catch(async (e) => {
  console.error(e)
  await pool.end()
  process.exit(1)
})
