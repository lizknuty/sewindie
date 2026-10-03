import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { booAndLuAdapter } from "../app/lib/pattern-sync/adapters/boo-and-lu"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"

const EXECUTE = process.env.EXECUTE === "1"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }),
})

const slugOf = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? ""
  } catch {
    return ""
  }
}
const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim()

const scraped = await booAndLuAdapter.fetchCatalogue()
const rows = await prisma.pattern.findMany({
  where: { url: { contains: "booandlu.com" } },
  select: { id: true, name: true, url: true, designer_id: true },
})
console.log("scraped", scraped.length, "db rows", rows.length, "designers", [...new Set(rows.map((r) => r.designer_id))])

const bySlug = new Map(rows.map((r) => [slugOf(r.url), r]))
const byName = new Map(rows.map((r) => [norm(r.name), r]))
const vocab = await loadVocab(prisma)

const totals = { audience: 0, category: 0, enriched: 0, matched: 0 }
const missing = new Map<string, number>()
const unmatchedTerms = new Map<string, number>()
const unmatchedRows: string[] = []
const catCounts = new Map<string, number>()
const audCounts = new Map<string, number>()

for (const p of scraped) {
  const row = bySlug.get(slugOf(p.url)) ?? byName.get(norm(p.name))
  if (!row) {
    unmatchedRows.push(`${p.kind} ${p.name}`)
    continue
  }
  totals.matched++
  const meta = p.metadata
  if (!meta) continue
  for (const c of meta.categories) catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
  for (const a of meta.audiences) audCounts.set(a, (audCounts.get(a) ?? 0) + 1)
  for (const u of meta.unmatched ?? []) unmatchedTerms.set(`${u.dimension}: ${u.term}`, 1)
  const plan = await applyMetadata(prisma, row.id, meta, vocab, EXECUTE)
  totals.audience += plan.toAdd.audience.length
  totals.category += plan.toAdd.category.length
  if (plan.toAdd.audience.length || plan.toAdd.category.length) totals.enriched++
  for (const m of plan.vocabMissing) missing.set(`${m.dimension}:${m.name}`, (missing.get(`${m.dimension}:${m.name}`) ?? 0) + 1)
}

console.log(EXECUTE ? "EXECUTED" : "DRY RUN", totals)
console.log("categories:", Object.fromEntries([...catCounts].sort((a, b) => b[1] - a[1])))
console.log("audiences:", Object.fromEntries([...audCounts].sort((a, b) => b[1] - a[1])))
console.log("VOCAB MISSING:", missing.size ? Object.fromEntries(missing) : "none")
const um = [...unmatchedTerms.keys()]
console.log("unmatched terms:", um.length)
for (const t of um) console.log("  UNMATCHED", t)
console.log("scraped with no DB row:", unmatchedRows.length, unmatchedRows.slice(0, 15))
await prisma.$disconnect()
