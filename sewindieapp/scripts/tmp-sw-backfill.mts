import { seamworkAdapter } from "../app/lib/pattern-sync/adapters/seamwork"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"
import { prisma } from "../app/lib/prisma"

const EXECUTE = process.env.EXECUTE === "1"
const slugOf = (url: string) => url.split("?")[0].replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? ""
const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

const t0 = Date.now()
const scraped = await seamworkAdapter.fetchCatalogue()
console.log(`scraped ${scraped.length} patterns in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (!scraped.some((p) => p.metadata?.audiences.length)) {
  throw new Error("Filter crawl did not complete (no audiences) -- aborting rather than writing name-only data")
}

const designer = await prisma.designer.findFirst({ where: { name: { contains: "Seamwork", mode: "insensitive" } } })
if (!designer) throw new Error("Seamwork designer not found")
const rows = await prisma.pattern.findMany({ where: { designer_id: designer.id }, select: { id: true, name: true, url: true } })
console.log(`designer #${designer.id} ${designer.name}: ${rows.length} DB patterns`)

const bySlug = new Map(scraped.map((p) => [slugOf(p.url), p]))
const byName = new Map(scraped.map((p) => [nameKey(p.name), p]))
const vocab = await loadVocab(prisma)

const totals = { audience: 0, category: 0, difficulty: 0, enriched: 0, unmatchedRows: [] as string[] }
const vocabMissing = new Map<string, number>()
const unmatchedTerms = new Map<string, number>()
const difficultyDist = new Map<string, number>()
const categoryDist = new Map<string, number>()

for (const row of rows) {
  const hit = bySlug.get(slugOf(row.url)) ?? byName.get(nameKey(row.name))
  if (!hit?.metadata) {
    totals.unmatchedRows.push(row.name)
    continue
  }
  const plan = await applyMetadata(prisma, row.id, hit.metadata, vocab, EXECUTE)
  totals.audience += plan.toAdd.audience.length
  totals.category += plan.toAdd.category.length
  if (plan.difficultySet) {
    totals.difficulty++
    difficultyDist.set(plan.difficultySet, (difficultyDist.get(plan.difficultySet) ?? 0) + 1)
  }
  for (const c of plan.toAdd.category) categoryDist.set(c, (categoryDist.get(c) ?? 0) + 1)
  if (plan.toAdd.audience.length || plan.toAdd.category.length || plan.difficultySet) totals.enriched++
  for (const m of plan.vocabMissing) vocabMissing.set(`${m.dimension}:${m.name}`, (vocabMissing.get(`${m.dimension}:${m.name}`) ?? 0) + 1)
  for (const u of hit.metadata.unmatched) unmatchedTerms.set(u.term, (unmatchedTerms.get(u.term) ?? 0) + 1)
}

const fmt = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(", ") || "none"
console.log(`\n${EXECUTE ? "EXECUTED" : "DRY RUN"}`)
console.log(`matched ${rows.length - totals.unmatchedRows.length}/${rows.length}, enriched ${totals.enriched}`)
console.log(`links to add: audience ${totals.audience}, category ${totals.category}; difficulty set ${totals.difficulty}`)
console.log(`difficulty: ${fmt(difficultyDist)}`)
console.log(`category: ${fmt(categoryDist)}`)
console.log(`VOCAB MISSING: ${fmt(vocabMissing)}`)
console.log(`UNMATCHED category names: ${fmt(unmatchedTerms)}`)
console.log(`UNMATCHED DB rows: ${totals.unmatchedRows.join(" | ") || "none"}`)
await prisma.$disconnect()
