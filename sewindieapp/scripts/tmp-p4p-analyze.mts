import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { patternsForPiratesAdapter } from "../app/lib/pattern-sync/adapters/patterns-for-pirates"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const BASE = "https://www.patternsforpirates.com/wp-json/wc/store/v1"

async function main() {
  // ---- Existing DB vocabulary ----
  const [audiences, categories, fabricTypes, attributes, suggested] = await Promise.all([
    prisma.audience.findMany({ select: { name: true } }),
    prisma.category.findMany({ select: { name: true } }),
    prisma.fabricType.findMany({ select: { name: true } }),
    prisma.attribute.findMany({ select: { name: true } }),
    prisma.suggestedFabric.findMany({ select: { name: true } }),
  ])
  console.log("=== EXISTING DB VOCABULARY ===")
  console.log("Audiences (" + audiences.length + "):", audiences.map((a) => a.name).sort().join(", "))
  console.log("Categories (" + categories.length + "):", categories.map((a) => a.name).sort().join(", "))
  console.log("FabricTypes (" + fabricTypes.length + "):", fabricTypes.map((a) => a.name).sort().join(", "))
  console.log("Attributes (" + attributes.length + "):", attributes.map((a) => a.name).sort().join(", "))
  console.log("SuggestedFabrics (" + suggested.length + "):", suggested.map((a) => a.name).sort().join(", "))

  // ---- P4P designer + current coverage ----
  const designer = await prisma.designer.findFirst({
    where: { url: { contains: "patternsforpirates" } },
    select: { id: true, name: true, url: true },
  })
  console.log("\n=== P4P DESIGNER ===", designer)
  if (designer) {
    const pats = await prisma.pattern.findMany({
      where: { designer_id: designer.id },
      select: {
        id: true, difficulty: true,
        PatternAudience: true, PatternCategory: true, PatternFabricType: true,
        PatternAttribute: true, PatternSuggestedFabric: true,
      },
    })
    const cov = (fn: (p: (typeof pats)[number]) => boolean) => pats.filter(fn).length
    console.log("Total P4P patterns in DB:", pats.length)
    console.log("  with difficulty:", cov((p) => !!p.difficulty))
    console.log("  with audience:", cov((p) => p.PatternAudience.length > 0))
    console.log("  with category:", cov((p) => p.PatternCategory.length > 0))
    console.log("  with fabricType:", cov((p) => p.PatternFabricType.length > 0))
    console.log("  with attribute:", cov((p) => p.PatternAttribute.length > 0))
    console.log("  with suggestedFabric:", cov((p) => p.PatternSuggestedFabric.length > 0))
  }

  // ---- Live P4P folksonomy frequency (categories + tags across full catalogue) ----
  const catFreq = new Map<string, number>()
  const tagFreq = new Map<string, number>()
  let total = 0
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${BASE}/products?per_page=100&page=${page}`, { headers: { "User-Agent": UA } })
    if (!res.ok) break
    const batch = (await res.json()) as any[]
    if (batch.length === 0) break
    total += batch.length
    for (const p of batch) {
      for (const c of p.categories ?? []) catFreq.set(c.name, (catFreq.get(c.name) ?? 0) + 1)
      for (const t of p.tags ?? []) tagFreq.set(t.name, (tagFreq.get(t.name) ?? 0) + 1)
    }
    if (batch.length < 100) break
  }
  const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
  console.log("\n=== LIVE P4P CATEGORIES (freq, " + total + " products) ===")
  for (const [name, n] of sortDesc(catFreq)) console.log(`  ${n}\t${name}`)
  console.log("\n=== LIVE P4P TAGS (freq) ===")
  for (const [name, n] of sortDesc(tagFreq)) console.log(`  ${n}\t${name}`)

  await prisma.$disconnect()
  await pool.end()
}
main().catch(async (e) => { console.error(e); process.exit(1) })
