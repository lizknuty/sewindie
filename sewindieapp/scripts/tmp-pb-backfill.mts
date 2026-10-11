import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { peekabooPatternShopAdapter } from "../app/lib/pattern-sync/adapters/peekaboo-pattern-shop"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"

const EXECUTE = process.env.EXECUTE === "1"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }),
})

const pathOf = (u: string | null) => {
  try {
    return new URL(u ?? "").pathname.replace(/\/+$/, "").toLowerCase()
  } catch {
    return ""
  }
}
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const scraped = await peekabooPatternShopAdapter.fetchCatalogue()
const withAudience = scraped.filter((p) => (p.metadata?.audiences.length ?? 0) > 0).length
console.log(`scraped ${scraped.length} | with audience ${withAudience}`)
if (withAudience < 300) throw new Error("category crawl looks incomplete -- aborting")

const designer = await prisma.designer.findFirst({ where: { name: { contains: "Peek", mode: "insensitive" } } })
if (!designer) throw new Error("designer not found")
const rows = await prisma.pattern.findMany({
  where: { designer_id: designer.id },
  select: { id: true, url: true, name: true },
})

const byPath = new Map(scraped.map((p) => [pathOf(p.url), p]))
const byName = new Map(scraped.map((p) => [nameKey(p.name), p]))
const vocab = await loadVocab(prisma)

const totals = { audience: 0, category: 0, fabricType: 0, difficulty: 0 }
const missing = new Map<string, number>()
let matched = 0
let byNameCount = 0
let enriched = 0
for (const row of rows) {
  let hit = byPath.get(pathOf(row.url))
  if (!hit && row.name) {
    hit = byName.get(nameKey(row.name))
    if (hit) byNameCount++
  }
  if (!hit?.metadata) continue
  matched++
  const plan = await applyMetadata(prisma, row.id, hit.metadata, vocab, EXECUTE)
  totals.audience += plan.toAdd.audience.length
  totals.category += plan.toAdd.category.length
  totals.fabricType += plan.toAdd.fabricType.length
  if (plan.difficultySet) totals.difficulty++
  if (plan.toAdd.audience.length + plan.toAdd.category.length + plan.toAdd.fabricType.length > 0 || plan.difficultySet)
    enriched++
  for (const m of plan.vocabMissing) missing.set(`${m.dimension}:${m.name}`, (missing.get(`${m.dimension}:${m.name}`) ?? 0) + 1)
}

console.log(
  `${EXECUTE ? "EXECUTED" : "DRY"}: designer ${designer.id} rows ${rows.length} | matched ${matched} (${byNameCount} by name) | enriched ${enriched}`,
)
console.log("links/values to add:", totals)
console.log("VOCAB MISSING:", missing.size ? Object.fromEntries(missing) : "none")
await prisma.$disconnect()
