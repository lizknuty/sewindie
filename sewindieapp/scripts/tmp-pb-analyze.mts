import { readFileSync } from "node:fs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }) })

const { cats } = JSON.parse(readFileSync("/tmp/pb-cats.json", "utf8")) as {
  cats: Record<string, { title?: string; count?: number; members?: string[] }>
}

const GROUPS: Record<string, string[]> = {
  audience: ["sewing-patterns-for-women", "sewing-patterns-for-men", "sewing-patterns-for-girls", "boys-sewing-patterns", "baby-sewing-patterns", "newborn-sewing-patterns", "preemie-sewing-patterns", "maternity-sewing-patterns"],
  skill: ["sewing-patterns-for-beginners", "intermediate-sewing-patterns"],
  fabric: ["knit-sewing-patterns", "woven-sewing-patterns"],
  garment: ["dress-patterns", "dress-patterns-for-women", "girls-dress-patterns", "skirt-patterns", "pants-patterns", "pants-and-skirts", "shorts-patterns", "girls-pants-pattern", "shirt-patterns", "sewing-patterns-for-womens-tops", "boys-shirt-hoodies-pullover-sewing-pattern", "hoodie-patterns", "jacket-patterns", "outerwear", "girls-jacket-pullover-and-hoodie-paterns", "boys-jacket-pullover-and-hoodie", "pajama-patterns", "womens-pajama-patterns", "girls-pajama-patterns", "boys-pajama-patterns", "swimsuit-patterns", "womens-swimsuit-patterns", "girls-swimsuit-pattern", "boys-swimsuit-patterns", "underwear-patterns", "womens-underwear-pattern", "boys-underwear-pattern", "leotard-patterns", "girls-romper-pattern", "boys-romper-sewing-pattern", "hat-patterns", "girls-hat-pattern", "shoe-patterns", "girls-shoes-sock-patterns", "boys-shoe-patterns"],
}

const byPath = new Map<string, Record<string, Set<string>>>()
for (const [group, slugs] of Object.entries(GROUPS)) {
  for (const slug of slugs) {
    for (const path of cats[slug]?.members ?? []) {
      const entry = byPath.get(path) ?? {}
      ;(entry[group] ??= new Set()).add(slug)
      byPath.set(path, entry)
    }
  }
}
const all = new Set(cats["sewing-patterns"]?.members ?? [])

const fabricTypes = await prisma.fabricType.findMany({ orderBy: { name: "asc" } })
console.log("FABRIC TYPES:", fabricTypes.map((f) => `${f.id}:${f.name}`).join(", "))

const designer = await prisma.designer.findFirst({ where: { name: { contains: "Peek", mode: "insensitive" } } })
if (!designer) throw new Error("designer not found")
const rows = await prisma.pattern.findMany({ where: { designer_id: designer.id }, select: { id: true, url: true, difficulty: true } })
const ids = rows.map((r) => r.id)
const withCat = new Set((await prisma.patternCategory.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true } })).map((r) => r.pattern_id))
const withAud = new Set((await prisma.patternAudience.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true } })).map((r) => r.pattern_id))
const withFab = new Set((await prisma.patternFabricType.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true } })).map((r) => r.pattern_id))

let matched = 0
const fill = { category: 0, audience: 0, difficulty: 0, fabric: 0 }
const missingAfter = { category: 0, audience: 0 }
const skillCombo: Record<string, number> = {}
for (const r of rows) {
  let path = ""
  try { path = new URL(r.url ?? "").pathname.replace(/\/+$/, "") } catch {}
  const sig = byPath.get(path)
  if (!all.has(path)) continue
  matched++
  const skills = [...(sig?.skill ?? [])].sort().join("+") || "none"
  skillCombo[skills] = (skillCombo[skills] ?? 0) + 1
  if (!withCat.has(r.id)) sig?.garment ? fill.category++ : missingAfter.category++
  if (!withAud.has(r.id)) sig?.audience ? fill.audience++ : missingAfter.audience++
  if (!r.difficulty && sig?.skill) fill.difficulty++
  if (!withFab.has(r.id) && sig?.fabric) fill.fabric++
}

console.log(`designer ${designer.id} ${designer.name}: ${rows.length} rows, ${matched} matched to live catalogue by URL path (catalogue ${all.size})`)
console.log("DB now: no category", rows.length - withCat.size, "| no audience", rows.length - withAud.size, "| no difficulty", rows.filter((r) => !r.difficulty).length, "| no fabric", rows.length - withFab.size)
console.log("would fill:", fill)
console.log("gaps the store can't fill (matched rows):", missingAfter)
console.log("skill combos:", skillCombo)
const cov = (g: string) => [...all].filter((p) => byPath.get(p)?.[g]).length
console.log("catalogue coverage: audience", cov("audience"), "| garment", cov("garment"), "| skill", cov("skill"), "| fabric", cov("fabric"))
const fabCombo: Record<string, number> = {}
for (const p of all) { const k = [...(byPath.get(p)?.fabric ?? [])].sort().join("+") || "none"; fabCombo[k] = (fabCombo[k] ?? 0) + 1 }
console.log("fabric combos:", fabCombo)
await prisma.$disconnect()
