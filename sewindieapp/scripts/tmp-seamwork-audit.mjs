import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import fs from "node:fs"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

async function main() {
  const list = JSON.parse(fs.readFileSync("/tmp/sw-cards.json", "utf8"))
  const db = await prisma.pattern.findMany({ where: { designer_id: 112 }, select: { id: true, name: true, url: true } })

  console.log("=== does a card literally named 'Zinnia Skirt' exist? ===")
  list
    .filter((c) => /zinnia/i.test(c.name) || /zinnia/i.test(c.href))
    .forEach((c) => console.log(`  name=${JSON.stringify(c.name)}  href=${c.href}`))

  console.log("\n=== DB rows containing Zinnia / Indigo / Greer / York ===")
  db.filter((r) => /zinnia|indigo|greer|york/i.test(r.name)).forEach((r) =>
    console.log(`  name=${JSON.stringify(r.name)}  url=${r.url}`),
  )

  console.log("\n=== cards for Indigo / Greer / York ===")
  list
    .filter((c) => /indigo|greer|york/i.test(c.name))
    .forEach((c) => console.log(`  name=${JSON.stringify(c.name)}  href=${c.href}`))

  // Recheck name match honestly, reporting collisions
  const byName = new Map()
  for (const c of list) {
    const k = norm(c.name)
    if (!byName.has(k)) byName.set(k, [])
    byName.get(k).push(c)
  }
  const dupNames = [...byName.entries()].filter(([, v]) => v.length > 1)
  console.log(`\nstore cards: ${list.length} | distinct normalized names: ${byName.size} | colliding names: ${dupNames.length}`)
  dupNames.slice(0, 5).forEach(([k, v]) => console.log(`  ${k} -> ${v.map((x) => x.href).join(" , ")}`))

  let hit = 0
  const misses = []
  for (const r of db) {
    if (byName.has(norm(r.name))) hit++
    else misses.push(r)
  }
  console.log(`\nDB rows matching a store card by exact normalized name: ${hit} / ${db.length}`)
  console.log("misses:", misses.length)
  misses.slice(0, 20).forEach((m) => console.log(`  ${JSON.stringify(m.name)}  ${m.url}`))

  // Which store cards are NOT referenced by any db row (the true "new" set)
  const dbNames = new Set(db.map((r) => norm(r.name)))
  const newCards = list.filter((c) => !dbNames.has(norm(c.name)))
  console.log(`\nstore cards with no DB name match (candidate NEW): ${newCards.length}`)
  const newBonus = newCards.filter((c) => /-bonus$/.test(c.href)).length
  console.log(`  of which bonus slugs: ${newBonus} | non-bonus: ${newCards.length - newBonus}`)
  console.log("\n  sample new (non-bonus):")
  newCards.filter((c) => !/-bonus$/.test(c.href)).slice(0, 12).forEach((c) => console.log(`    ${c.name}  ->  ${c.href}`))
  console.log("\n  sample new (bonus):")
  newCards.filter((c) => /-bonus$/.test(c.href)).slice(0, 10).forEach((c) => console.log(`    ${c.name}  ->  ${c.href}`))

  // price signal
  const prices = {}
  for (const c of list) prices[c.price || "(none)"] = (prices[c.price || "(none)"] || 0) + 1
  console.log("\n=== price values ===")
  Object.entries(prices)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))
}

main()
  .catch((e) => console.log("ERR", e.message))
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
