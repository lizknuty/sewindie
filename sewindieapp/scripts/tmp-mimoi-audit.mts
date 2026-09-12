import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ""
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  const designer = await prisma.designer.findFirst({
    where: { name: { contains: "Mimo", mode: "insensitive" } },
    select: { id: true, name: true, url: true },
  })
  if (!designer) throw new Error("Mimoï designer not found")
  console.log("Designer:", designer.id, designer.name, designer.url)

  const patterns = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: {
      id: true,
      name: true,
      url: true,
      release_date: true,
      thumbnail_url: true,
      PatternCategory: { select: { category: { select: { id: true, name: true } } } },
    },
    orderBy: { id: "asc" },
  })

  console.log(`\nTOTAL Mimoï patterns: ${patterns.length}\n`)

  const ids = patterns.map((p) => p.id)
  const [favs, ratings, feat, formats, sizecharts, attrs, audiences, fabrics, sugg] = await Promise.all([
    prisma.favorite.groupBy({ by: ["patternId"], where: { patternId: { in: ids } }, _count: true }),
    prisma.rating.groupBy({ by: ["patternId"], where: { patternId: { in: ids } }, _count: true }),
    prisma.featuredPattern.findMany({ where: { pattern_id: { in: ids } }, select: { pattern_id: true } }),
    prisma.patternFormat.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
    prisma.patternSizeChart.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
    prisma.patternAttribute.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
    prisma.patternAudience.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
    prisma.patternFabricType.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
    prisma.patternSuggestedFabric.groupBy({ by: ["pattern_id"], where: { pattern_id: { in: ids } }, _count: true }),
  ])
  const m = (arr: { pattern_id: number; _count: unknown }[]) =>
    new Map(arr.map((r) => [r.pattern_id, typeof r._count === "number" ? r._count : 1]))
  const mCamel = (arr: { patternId: number; _count: unknown }[]) =>
    new Map(arr.map((r) => [r.patternId, typeof r._count === "number" ? r._count : 1]))
  const mf = mCamel(favs), mr = mCamel(ratings), mfo = m(formats), msc = m(sizecharts), ma = m(attrs), mau = m(audiences), mft = m(fabrics), msg = m(sugg)
  const featSet = new Set(feat.map((f) => f.pattern_id))

  for (const p of patterns) {
    const cats = p.PatternCategory.map((pc) => pc.category.name).join(", ") || "(none)"
    const path = p.url.replace(/^https?:\/\/[^/]+/, "")
    const rd = p.release_date ? p.release_date.toISOString().slice(0, 10) : "no-date"
    const refs: string[] = []
    if (mf.get(p.id)) refs.push(`fav:${mf.get(p.id)}`)
    if (mr.get(p.id)) refs.push(`rat:${mr.get(p.id)}`)
    if (featSet.has(p.id)) refs.push("FEATURED")
    if (mfo.get(p.id)) refs.push(`fmt:${mfo.get(p.id)}`)
    if (msc.get(p.id)) refs.push(`size:${msc.get(p.id)}`)
    if (ma.get(p.id)) refs.push(`attr:${ma.get(p.id)}`)
    if (mau.get(p.id)) refs.push(`aud:${mau.get(p.id)}`)
    if (mft.get(p.id)) refs.push(`fab:${mft.get(p.id)}`)
    if (msg.get(p.id)) refs.push(`sug:${msg.get(p.id)}`)
    const refStr = refs.length ? refs.join(",") : "-"
    console.log(`#${p.id}\t${rd}\t[${cats}]\t{${refStr}}\t${p.name}\t=> ${path}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
