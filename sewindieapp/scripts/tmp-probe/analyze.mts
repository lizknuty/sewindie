import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }),
})

const dir = new URL(".", import.meta.url).pathname
const only = process.env.STORE
const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, "") } catch { return "" }
}
const lastSeg = (u: string) => {
  try { return new URL(u).pathname.split("/").filter(Boolean).pop()?.toLowerCase() ?? "" } catch { return "" }
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const designers = await prisma.designer.findMany({ select: { id: true, name: true, url: true } })

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const slug = f.replace(/\.json$/, "")
  if (only && only !== slug) continue
  const data = JSON.parse(readFileSync(join(dir, f), "utf8"))
  const h = host(data.store.base)
  const d = designers.find((x) => host(x.url) === h) ??
    designers.find((x) => norm(x.name) === norm(data.store.label))
  console.log(`\n===== ${data.store.label} (${slug}) products=${data.productCount} designer=${d ? `${d.id} ${d.name}` : "NOT FOUND"}`)
  console.log("TYPES:", data.productTypes.slice(0, 30).map((t: any) => `${t.value}=${t.count}`).join(" | "))
  console.log("TAGS:", data.tags.slice(0, Number(process.env.NTAGS ?? 70)).map((t: any) => `${t.value}=${t.count}`).join(" | "))
  const ns: Record<string, number> = {}
  for (const t of data.tags) {
    const m = String(t.value).match(/^([A-Za-zÀ-ÿ\- ]+?)[_:]/)
    if (m) ns[m[1]] = (ns[m[1]] ?? 0) + 1
  }
  console.log("TAG NAMESPACES:", Object.entries(ns).map(([k, v]) => `${k}(${v})`).join(" "))
  if (!d) continue

  const rows = await prisma.pattern.findMany({
    where: { designer_id: d.id },
    select: { id: true, name: true, url: true, difficulty: true },
  })
  const ids = rows.map((r) => r.id)
  const withCat = new Set((await prisma.patternCategory.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true }, distinct: ["pattern_id"] })).map((r) => r.pattern_id))
  const withAud = new Set((await prisma.patternAudience.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true }, distinct: ["pattern_id"] })).map((r) => r.pattern_id))
  const withFab = new Set((await prisma.patternFabricType.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true }, distinct: ["pattern_id"] })).map((r) => r.pattern_id))
  console.log(`DB rows=${rows.length} missingCat=${rows.length - withCat.size} missingAud=${rows.length - withAud.size} missingDiff=${rows.filter((r) => !r.difficulty).length} missingFab=${rows.length - withFab.size}`)

  const handles = new Set(data.products.map((p: any) => String(p.handle).toLowerCase()))
  const titles = new Set(data.products.map((p: any) => norm(p.title)))
  let byHandle = 0, byName = 0
  const miss: string[] = []
  for (const r of rows) {
    if (handles.has(lastSeg(r.url))) byHandle++
    else if (titles.has(norm(r.name))) byName++
    else miss.push(`${r.name} <${r.url}>`)
  }
  console.log(`MATCH byHandle=${byHandle} byName=${byName} unmatched=${miss.length}`)
  console.log("UNMATCHED SAMPLE:", miss.slice(0, 8).join(" ;; "))
  console.log("URL SAMPLE:", rows.slice(0, 3).map((r) => r.url).join(" ;; "))
}
await prisma.$disconnect()
