// Recon only. Reads the DB and the store; writes nothing.
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"

async function main() {
  console.log("=== designers matching 'allie' / 'olson' ===")
  const matches = await prisma.designer.findMany({
    where: {
      OR: [
        { name: { contains: "allie", mode: "insensitive" } },
        { name: { contains: "olson", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, url: true, status: true, logo_url: true },
  })
  console.log(matches.length === 0 ? "  (none)" : "")
  matches.forEach((d) => console.log(`  [${d.id}] ${d.name} | ${d.url} | ${d.status}`))

  console.log("\n=== designer count & a few recent ===")
  const total = await prisma.designer.count()
  console.log(`  total designers: ${total}`)
  const recent = await prisma.designer.findMany({
    orderBy: { id: "desc" },
    take: 6,
    select: { id: true, name: true, url: true },
  })
  recent.forEach((d) => console.log(`  [${d.id}] ${d.name} | ${d.url}`))

  // Which relations do well-populated designers actually use? This decides how
  // much of the schema a new import is expected to fill.
  console.log("\n=== relation coverage on a mature designer (43 Fibre Mood) ===")
  for (const id of [43]) {
    const pats = await prisma.pattern.count({ where: { designer_id: id } })
    const withCat = await prisma.patternCategory.count({ where: { pattern: { designer_id: id } } })
    const withAud = await prisma.patternAudience.count({ where: { pattern: { designer_id: id } } })
    const withFmt = await prisma.patternFormat.count({ where: { Pattern: { designer_id: id } } })
    const withAttr = await prisma.patternAttribute.count({ where: { pattern: { designer_id: id } } })
    const withFab = await prisma.patternFabricType.count({ where: { pattern: { designer_id: id } } })
    console.log(`  patterns=${pats} category=${withCat} audience=${withAud} format=${withFmt} attribute=${withAttr} fabric=${withFab}`)
  }

  console.log("\n=== how many patterns have optional scalars filled (whole table) ===")
  const pTotal = await prisma.pattern.count()
  const hasThumb = await prisma.pattern.count({ where: { thumbnail_url: { not: null } } })
  const hasDiff = await prisma.pattern.count({ where: { difficulty: { not: null } } })
  const hasYard = await prisma.pattern.count({ where: { yardage: { not: null } } })
  const hasLang = await prisma.pattern.count({ where: { language: { not: null } } })
  const hasRel = await prisma.pattern.count({ where: { release_date: { not: null } } })
  console.log(`  total=${pTotal} thumb=${hasThumb} difficulty=${hasDiff} yardage=${hasYard} language=${hasLang} release_date=${hasRel}`)

  console.log("\n=== vocabularies available ===")
  for (const [label, rows] of [
    ["Category", await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } })],
    ["Audience", await prisma.audience.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } })],
    ["Format", await prisma.format.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } })],
  ]) {
    console.log(`  ${label} (${rows.length}): ${rows.map((r) => `${r.id}:${r.name}`).join(", ")}`)
  }

  console.log("\n=== is allieolson.com Shopify? ===")
  for (const path of [
    "/collections/digital-patterns/products.json?limit=250",
    "/products.json?limit=250",
  ]) {
    const url = `https://allieolson.com${path}`
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) })
      const type = res.headers.get("content-type") ?? ""
      let count = null
      if (res.ok && type.includes("json")) {
        const body = await res.json()
        count = body?.products?.length ?? null
      }
      console.log(`  ${res.status} ${type.split(";")[0]} products=${count}  ${path}`)
    } catch (error) {
      console.log(`  ERR ${error.message}  ${path}`)
    }
  }
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
