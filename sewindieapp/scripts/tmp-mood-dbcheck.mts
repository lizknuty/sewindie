import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter } as any)

const diffs = await prisma.$queryRawUnsafe<any[]>(
  `SELECT difficulty, count(*)::int AS n FROM "Pattern" GROUP BY difficulty ORDER BY n DESC`,
)
console.log("=== DISTINCT difficulty values (whole DB) ===")
for (const d of diffs) console.log(`  ${d.n}\t${d.difficulty === null ? "(null)" : JSON.stringify(d.difficulty)}`)

const candidates = await prisma.designer.findMany({
  where: { name: { contains: "Mood", mode: "insensitive" } },
  select: { id: true, name: true, url: true },
})
console.log("\n=== Mood-ish designers ===", JSON.stringify(candidates))
const d = candidates.find((c) => /sewciety/i.test(c.name) || /moodfabrics\.com/i.test(c.url ?? "")) ?? null
console.log("=== chosen Mood Sewciety designer ===", JSON.stringify(d))
if (d) {
  const pats = await prisma.pattern.findMany({
    where: { designer_id: d.id },
    select: {
      id: true,
      difficulty: true,
      PatternAudience: { select: { audience_id: true } },
      PatternCategory: { select: { category_id: true } },
      PatternFabricType: { select: { fabrictype_id: true } },
      PatternAttribute: { select: { attribute_id: true } },
      PatternSuggestedFabric: { select: { suggestedfabric_id: true } },
    },
  })
  console.log("total Mood patterns:", pats.length)
  const cnt = (f: (p: any) => boolean) => pats.filter(f).length
  console.log("  with difficulty:     ", cnt((p) => p.difficulty))
  console.log("  with audience link:  ", cnt((p) => p.PatternAudience.length))
  console.log("  with category link:  ", cnt((p) => p.PatternCategory.length))
  console.log("  with fabricType link:", cnt((p) => p.PatternFabricType.length))
  console.log("  with attribute link: ", cnt((p) => p.PatternAttribute.length))
  console.log("  with suggFabric link:", cnt((p) => p.PatternSuggestedFabric.length))
}
await prisma.$disconnect()
