import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter } as never)

async function main() {
  const designer = await prisma.designer.findFirst({
    where: { name: { contains: "Grasser", mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (!designer) {
    console.log("No Grasser designer found")
    const all = await prisma.designer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    console.log(all.map((d) => `${d.id}:${d.name}`).join(" | "))
    return
  }
  console.log("Designer:", designer.id, designer.name)

  const patterns = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: {
      id: true,
      difficulty: true,
      _count: {
        select: {
          PatternAudience: true,
          PatternCategory: true,
          PatternFabricType: true,
          PatternAttribute: true,
          PatternSuggestedFabric: true,
        },
      },
    },
  })

  const total = patterns.length
  const withDifficulty = patterns.filter((p) => p.difficulty && p.difficulty.trim() !== "").length
  const withAudience = patterns.filter((p) => p._count.audiences > 0).length
  const withCategory = patterns.filter((p) => p._count.categories > 0).length
  const withFabricType = patterns.filter((p) => p._count.fabricTypes > 0).length
  const withAttr = patterns.filter((p) => p._count.attributes > 0).length
  const withSugg = patterns.filter((p) => p._count.suggestedFabrics > 0).length

  console.log(`total patterns: ${total}`)
  console.log(`  difficulty set:     ${withDifficulty}`)
  console.log(`  audience linked:    ${withAudience}`)
  console.log(`  category linked:    ${withCategory}`)
  console.log(`  fabricType linked:  ${withFabricType}`)
  console.log(`  attribute linked:   ${withAttr}`)
  console.log(`  suggestedFabric:    ${withSugg}`)

  const diffValues = await prisma.pattern.groupBy({
    by: ["difficulty"],
    where: { difficulty: { not: null } },
    _count: true,
  })
  console.log("\nDistinct difficulty values across ALL patterns:")
  for (const d of diffValues.sort((a, b) => b._count - a._count)) {
    console.log(`  [${d.difficulty}] x${d._count}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
