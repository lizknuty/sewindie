// Post-apply verification for the Fibre Mood truncated-name repair.
// Read-only. Confirms the ellipsis is gone, no name was mangled, and the
// catalogue naming convention still holds.

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

const DESIGNER_ID = 43
const TRUNC = /(?:\.{3}|\u2026)\s*$/

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    })

    const stillTruncated = rows.filter((r) => TRUNC.test(r.name ?? ""))
    const properSuffix = rows.filter((r) => /\b(Digital|Paper) Pattern$/.test(r.name ?? ""))
    const doubledPattern = rows.filter((r) => /Pattern\s+\w*\s*Pattern$/i.test(r.name ?? ""))
    const lowercaseWords = rows.filter((r) =>
      / (girl|mobile|phone|bag|dress|skirt)\b/.test(r.name ?? ""),
    )

    console.log(`=== Fibre Mood names after apply (${rows.length} rows) ===`)
    console.log(`  still truncated                : ${stillTruncated.length}`)
    console.log(`  end in "<Digital|Paper> Pattern": ${properSuffix.length}`)
    console.log(`  doubled "Pattern Pattern"      : ${doubledPattern.length} (must be 0)`)
    console.log(`  lowercase mid-name words       : ${lowercaseWords.length} (must be 0)`)

    if (stillTruncated.length > 0) {
      console.log(`\n=== still truncated (expected: the 3 ambiguous + 3 not-in-store) ===`)
      stillTruncated.forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }
    if (doubledPattern.length > 0) {
      console.log(`\n!!! doubled Pattern suffix:`)
      doubledPattern.forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }
    if (lowercaseWords.length > 0) {
      console.log(`\n!!! lowercase mid-name words (store casing leaked in):`)
      lowercaseWords.forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }

    // Duplicate names would break the name-based sync matching.
    const byName = new Map()
    for (const r of rows) {
      const k = (r.name ?? "").trim().toLowerCase()
      if (!byName.has(k)) byName.set(k, [])
      byName.get(k).push(r.id)
    }
    const dupes = [...byName.entries()].filter(([, ids]) => ids.length > 1)
    console.log(`\n  duplicate names                : ${dupes.length}`)
    dupes.slice(0, 10).forEach(([n, ids]) => console.log(`    "${n}" -> ${ids.join(", ")}`))

    console.log(`\n=== sample of completed names ===`)
    rows
      .filter((r) => /\b(Digital|Paper) Pattern$/.test(r.name ?? ""))
      .slice(0, 8)
      .forEach((r) => console.log(`  [${r.id}] ${r.name}`))
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
