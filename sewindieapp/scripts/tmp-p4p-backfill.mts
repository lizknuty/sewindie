import { prisma } from "../app/lib/prisma"
import { fetchP4PStoreProducts, extractP4PMetadata } from "../app/lib/pattern-sync/metadata/patterns-for-pirates"
import { normalizeUrl } from "../app/lib/pattern-sync/compare"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"
import type { MetadataDimension } from "../app/lib/pattern-sync/metadata/types"

// One-time metadata backfill for Patterns for Pirates.
//
//   npx tsx scripts/tmp-p4p-backfill.mts            # dry run (writes nothing)
//   EXECUTE=1 npx tsx scripts/tmp-p4p-backfill.mts   # apply, additive only
//
// Matches existing patterns to live Store API products by normalized URL,
// falling back to normalized name, then links audience/category/fabric-type/
// attribute/suggested-fabric additively. Never removes an existing link.

const EXECUTE = process.env.EXECUTE === "1"
const DESIGNER_NAME = "Patterns for Pirates"

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

async function main() {
  const designer = await prisma.designer.findFirst({
    where: { name: DESIGNER_NAME },
    select: { id: true, name: true },
  })
  if (!designer) throw new Error(`Designer "${DESIGNER_NAME}" not found`)

  const patterns = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: { id: true, name: true, url: true },
  })
  console.log(`Designer #${designer.id} ${designer.name}: ${patterns.length} patterns in catalogue`)

  const storeById = await fetchP4PStoreProducts()
  console.log(`Fetched ${storeById.size} live Store API products`)

  // Index store products by normalized URL and normalized name for matching.
  const storeByUrl = new Map<string, ReturnType<typeof storeById.get>>()
  const storeByName = new Map<string, ReturnType<typeof storeById.get>>()
  for (const p of storeById.values()) {
    const u = normalizeUrl(p.permalink)
    if (u && !storeByUrl.has(u)) storeByUrl.set(u, p)
    const n = normName(p.name)
    if (n && !storeByName.has(n)) storeByName.set(n, p)
  }

  const vocab = await loadVocab(prisma as any)

  const dimTotals: Record<MetadataDimension, number> = {
    audience: 0, category: 0, fabricType: 0, attribute: 0, suggestedFabric: 0,
  }
  const vocabMissing = new Map<string, { dimension: string; name: string; count: number }>()
  const unmatchedStoreTerms = new Map<string, number>()
  let matched = 0
  let unmatchedPatterns = 0
  let enriched = 0
  const examples: string[] = []

  for (const pat of patterns) {
    const u = normalizeUrl(pat.url)
    const store =
      (u ? storeByUrl.get(u) : undefined) ?? storeByName.get(normName(pat.name))
    if (!store) {
      unmatchedPatterns++
      continue
    }
    matched++

    const meta = extractP4PMetadata(store)
    for (const t of meta.unmatched) {
      const key = `${t.dimension}:${t.term}`
      unmatchedStoreTerms.set(key, (unmatchedStoreTerms.get(key) ?? 0) + 1)
    }

    const plan = await applyMetadata(prisma as any, pat.id, meta, vocab, EXECUTE)
    const added =
      plan.toAdd.audience.length + plan.toAdd.category.length + plan.toAdd.fabricType.length +
      plan.toAdd.attribute.length + plan.toAdd.suggestedFabric.length
    dimTotals.audience += plan.toAdd.audience.length
    dimTotals.category += plan.toAdd.category.length
    dimTotals.fabricType += plan.toAdd.fabricType.length
    dimTotals.attribute += plan.toAdd.attribute.length
    dimTotals.suggestedFabric += plan.toAdd.suggestedFabric.length
    for (const miss of plan.vocabMissing) {
      const key = `${miss.dimension}:${miss.name}`
      const cur = vocabMissing.get(key)
      if (cur) cur.count++
      else vocabMissing.set(key, { dimension: miss.dimension, name: miss.name, count: 1 })
    }

    if (added > 0) {
      enriched++
      if (examples.length < 15) {
        const parts: string[] = []
        if (plan.toAdd.audience.length) parts.push(`aud=[${plan.toAdd.audience.join(", ")}]`)
        if (plan.toAdd.category.length) parts.push(`cat=[${plan.toAdd.category.join(", ")}]`)
        if (plan.toAdd.fabricType.length) parts.push(`fab=[${plan.toAdd.fabricType.join(", ")}]`)
        if (plan.toAdd.attribute.length) parts.push(`attr=[${plan.toAdd.attribute.join(", ")}]`)
        if (plan.toAdd.suggestedFabric.length) parts.push(`sugg=[${plan.toAdd.suggestedFabric.join(", ")}]`)
        examples.push(`  • ${pat.name}: ${parts.join("  ")}`)
      }
    }
  }

  console.log(`\n=== ${EXECUTE ? "EXECUTED" : "DRY RUN"} ===`)
  console.log(`Matched to store:   ${matched}`)
  console.log(`Unmatched patterns: ${unmatchedPatterns}`)
  console.log(`Patterns enriched:  ${enriched}`)
  console.log(`\nLinks ${EXECUTE ? "added" : "to add"} by dimension:`)
  for (const [dim, n] of Object.entries(dimTotals)) console.log(`  ${dim.padEnd(16)} ${n}`)

  console.log(`\nSAMPLE ENRICHMENTS:`)
  console.log(examples.join("\n"))

  const vm = [...vocabMissing.values()].sort((a, b) => b.count - a.count)
  console.log(`\nVOCAB MISSING (mapped name has no DB row) -- ${vm.length} distinct:`)
  for (const m of vm.slice(0, 40)) console.log(`  [${m.dimension}] ${m.name} (${m.count})`)

  const ust = [...unmatchedStoreTerms.entries()].sort((a, b) => b[1] - a[1])
  console.log(`\nUNMAPPED STORE TERMS (no mapping table entry) -- ${ust.length} distinct:`)
  for (const [term, n] of ust.slice(0, 60)) console.log(`  ${term} (${n})`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
