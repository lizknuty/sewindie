import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const [audiences, categories] = await Promise.all([
    prisma.audience.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ])
  console.log("=== AUDIENCE (" + audiences.length + ") ===")
  console.log(audiences.map((a) => a.name).join(" | "))
  console.log("\n=== CATEGORY (" + categories.length + ") ===")
  console.log(categories.map((c) => c.name).join(" | "))

  // Existing distinct difficulty values on Pattern
  const diffs = await prisma.pattern.groupBy({
    by: ["difficulty"],
    _count: { difficulty: true },
  })
  console.log("\n=== DIFFICULTY values in use ===")
  for (const d of diffs.sort((a, b) => (b._count.difficulty ?? 0) - (a._count.difficulty ?? 0))) {
    console.log(`  ${JSON.stringify(d.difficulty)}\t${d._count.difficulty}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
