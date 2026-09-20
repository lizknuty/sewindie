import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })
  const audiences = await prisma.audience.findMany({ orderBy: { name: "asc" } })
  const difficulties = await prisma.pattern.findMany({
    where: { difficulty: { not: null } },
    distinct: ["difficulty"],
    select: { difficulty: true },
    orderBy: { difficulty: "asc" },
  })

  console.log("=== CATEGORIES (" + categories.length + ") ===")
  for (const c of categories) console.log("  " + c.id + "\t" + c.name)
  console.log("\n=== AUDIENCES (" + audiences.length + ") ===")
  for (const a of audiences) console.log("  " + a.id + "\t" + a.name)
  console.log("\n=== DISTINCT difficulty values ===")
  for (const d of difficulties) console.log("  " + JSON.stringify(d.difficulty))
}

main().finally(() => prisma.$disconnect())
