// How does this catalogue ALREADY categorize the garment types Allie Olson
// sells? Matching existing convention matters more than my own taste.
// Read-only.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const NOUNS = ["cardigan", "pullover", "jacket", "vest", "tank", "jeans", "pants", "skirt", "wrap dress"]

async function main() {
  console.log("=== existing category convention by garment noun ===")
  for (const noun of NOUNS) {
    const rows = await prisma.pattern.findMany({
      where: { name: { contains: noun, mode: "insensitive" } },
      select: {
        name: true,
        PatternCategory: { select: { category: { select: { name: true } } } },
      },
      take: 400,
    })
    const tally = new Map()
    let withCat = 0
    for (const r of rows) {
      if (r.PatternCategory.length > 0) withCat++
      for (const pc of r.PatternCategory) {
        const n = pc.category.name
        tally.set(n, (tally.get(n) ?? 0) + 1)
      }
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(
      `  "${noun}" rows=${rows.length} categorized=${withCat} -> ${top.map(([n, c]) => `${n}(${c})`).join(", ") || "(none)"}`,
    )
  }

  console.log("\n=== audience convention for adult women's garments ===")
  const audTally = await prisma.patternAudience.groupBy({
    by: ["audience_id"],
    _count: { audience_id: true },
    orderBy: { _count: { audience_id: "desc" } },
  })
  const auds = await prisma.audience.findMany({ select: { id: true, name: true } })
  const audName = new Map(auds.map((a) => [a.id, a.name]))
  audTally.forEach((a) => console.log(`  ${audName.get(a.audience_id)}: ${a._count.audience_id}`))

  console.log("\n=== format convention ===")
  const fmtTally = await prisma.patternFormat.groupBy({
    by: ["format_id"],
    _count: { format_id: true },
    orderBy: { _count: { format_id: "desc" } },
  })
  const fmts = await prisma.format.findMany({ select: { id: true, name: true } })
  const fmtName = new Map(fmts.map((f) => [f.id, f.name]))
  fmtTally.forEach((f) => console.log(`  ${fmtName.get(f.format_id)}: ${f._count.format_id}`))

  console.log("\n=== language values in use ===")
  const langs = await prisma.pattern.groupBy({
    by: ["language"],
    _count: { language: true },
    orderBy: { _count: { language: "desc" } },
    take: 8,
  })
  langs.forEach((l) => console.log(`  ${JSON.stringify(l.language)}: ${l._count.language}`))

  console.log("\n=== designer 4 current state ===")
  const d = await prisma.designer.findUnique({
    where: { id: 4 },
    select: { id: true, name: true, url: true, status: true, logo_url: true, instagram: true },
  })
  console.log(`  ${JSON.stringify(d, null, 2)}`)
  const existing = await prisma.pattern.count({ where: { designer_id: 4 } })
  console.log(`  patterns for designer 4: ${existing}`)

  // Any pattern anywhere already named like an Allie Olson design? Guards
  // against importing a duplicate that another designer's row already covers,
  // and against re-running this import twice.
  console.log("\n=== name collisions across whole catalogue ===")
  const names = [
    "Ponderosa Pants", "Hive Pullover", "Buttress Jeans", "Kila Tank",
    "Highlands Wrap Dress", "Coram Top and Dress", "Monarch Jacket",
    "Elio Top", "Neffy Cardigan", "Weaver Skirt", "Lonetree Jacket and Vest",
  ]
  for (const name of names) {
    const hits = await prisma.pattern.findMany({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, designer: { select: { id: true, name: true } } },
    })
    if (hits.length > 0) {
      hits.forEach((h) => console.log(`  COLLISION "${name}" -> [${h.id}] under designer ${h.designer.id} ${h.designer.name}`))
    }
  }
  console.log("  (blank above means no collisions)")

  console.log("\n=== url shape used by other patterns (sample) ===")
  const sample = await prisma.pattern.findMany({
    where: { url: { contains: "myshopify" } },
    select: { url: true },
    take: 3,
  })
  const sample2 = await prisma.pattern.findMany({
    select: { url: true, designer: { select: { name: true } } },
    take: 5,
    orderBy: { id: "desc" },
  })
  sample.forEach((s) => console.log(`  ${s.url}`))
  sample2.forEach((s) => console.log(`  ${s.designer.name}: ${s.url}`))
}

main()
  .catch((error) => {
    console.error("FAILED:", error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
