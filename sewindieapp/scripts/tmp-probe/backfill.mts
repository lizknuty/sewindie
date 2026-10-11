import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { applyMetadata, loadVocab } from "../../app/lib/pattern-sync/metadata/writer"
import { extractShopifyStoreMetadata, type ShopifyStoreSlug } from "../../app/lib/pattern-sync/metadata/shopify-stores"
import { cleanJalieName } from "../../app/lib/pattern-sync/adapters/jalie"
import { cleanWinsletsName } from "../../app/lib/pattern-sync/adapters/winslets"
import { cleanWinterWearName } from "../../app/lib/pattern-sync/adapters/winter-wear-designs"
import { cleanFauveName } from "../../app/lib/pattern-sync/adapters/maison-fauve"
import { cleanPatternEmporiumName } from "../../app/lib/pattern-sync/adapters/pattern-emporium"

const EXECUTE = process.env.EXECUTE === "1"
const ONLY = process.env.STORE
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }),
})
const dir = new URL(".", import.meta.url).pathname

const verbatim = (t: string) => t.replace(/\s+/g, " ").trim()
const STORES: Array<[ShopifyStoreSlug, (t: string) => string]> = [
  ["petite-stitchery", verbatim],
  ["jalie", cleanJalieName],
  ["winslets", cleanWinsletsName],
  ["winter-wear-designs", cleanWinterWearName],
  ["maison-fauve", cleanFauveName],
  ["pattern-emporium", cleanPatternEmporiumName],
  ["violette-field-threads", verbatim],
  ["ellie-and-mac", verbatim],
]

const host = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, "") } catch { return "" }
}
const lastSeg = (u: string) => {
  try { return new URL(u).pathname.split("/").filter(Boolean).pop()?.toLowerCase() ?? "" } catch { return "" }
}
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const vocab = await loadVocab(prisma)
const designers = await prisma.designer.findMany({ select: { id: true, name: true, url: true } })
const grand = { matched: 0, enriched: 0, audience: 0, category: 0, fabricType: 0, difficulty: 0, missing: 0 }

for (const [slug, clean] of STORES) {
  if (ONLY && ONLY !== slug) continue
  const data = JSON.parse(readFileSync(join(dir, `${slug}.json`), "utf8"))
  const h = host(data.store.base)
  const d = designers.find((x) => host(x.url ?? "") === h) ?? designers.find((x) => norm(x.name) === norm(data.store.label))
  if (!d) { console.log(`${slug}: DESIGNER NOT FOUND`); continue }

  const rows = await prisma.pattern.findMany({ where: { designer_id: d.id }, select: { id: true, name: true, url: true } })
  const byHandle = new Map(rows.map((r) => [lastSeg(r.url ?? ""), r]))
  const byName = new Map(rows.map((r) => [norm(r.name), r]))
  const assigned = new Map<number, ReturnType<typeof extractShopifyStoreMetadata>>()
  let viaName = 0

  // Handle matches first, so a name fallback never steals a handle-matched row.
  const products = data.products as Array<{ handle: string; title: string; product_type?: string; tags?: string[]; body?: string }>
  const metaFor = (p: (typeof products)[number]) =>
    extractShopifyStoreMetadata(slug, { name: clean(p.title), handle: p.handle, productType: p.product_type, tags: p.tags, bodyHtml: p.body })
  for (const p of products) {
    const row = byHandle.get(String(p.handle).toLowerCase())
    if (row && !assigned.has(row.id)) assigned.set(row.id, metaFor(p))
  }
  for (const p of products) {
    const row = byName.get(norm(clean(p.title)))
    if (row && !assigned.has(row.id)) { assigned.set(row.id, metaFor(p)); viaName++ }
  }

  const s = { enriched: 0, audience: 0, category: 0, fabricType: 0, difficulty: 0, missing: 0 }
  const misses = new Map<string, number>()
  const noCat: string[] = []
  for (const [id, meta] of assigned) {
    if (meta.categories.length === 0) noCat.push(rows.find((r) => r.id === id)!.name)
    const plan = await applyMetadata(prisma, id, meta, vocab, EXECUTE)
    const add = plan.toAdd.audience.length + plan.toAdd.category.length + plan.toAdd.fabricType.length + (plan.difficultySet ? 1 : 0)
    if (add > 0) s.enriched++
    s.audience += plan.toAdd.audience.length
    s.category += plan.toAdd.category.length
    s.fabricType += plan.toAdd.fabricType.length
    if (plan.difficultySet) s.difficulty++
    for (const m of plan.vocabMissing) misses.set(`${m.dimension}:${m.name}`, (misses.get(`${m.dimension}:${m.name}`) ?? 0) + 1)
    s.missing += plan.vocabMissing.length
  }
  grand.matched += assigned.size
  for (const k of Object.keys(s) as Array<keyof typeof s>) grand[k] += s[k]
  console.log(
    `${slug} (#${d.id}): rows=${rows.length} matched=${assigned.size} (${viaName} by name) enriched=${s.enriched} ` +
      `+aud=${s.audience} +cat=${s.category} +fab=${s.fabricType} +diff=${s.difficulty} vocabMissing=${s.missing}`,
  )
  if (misses.size) console.log("  VOCAB MISSING:", [...misses].map(([k, v]) => `${k}=${v}`).join(" | "))
  console.log(`  no category (${noCat.length}):`, noCat.slice(0, 12).join(" ; "))
}
console.log(`${EXECUTE ? "EXECUTED" : "DRY RUN"} TOTAL:`, JSON.stringify(grand))
await prisma.$disconnect()
