// One-off casing repair for Greenstyle Creations pattern names (designer_id 57).
//
// Rules agreed with the user:
//  1. Rows differing from the live store title by CASING ONLY -> take the store title.
//  2. Rows whose store title changes actual WORDING           -> repair casing in place
//     from the row's own text, so no wording is gained or lost.
//  3. Rows with no store match, or already identical          -> untouched.
//
// Read-only by default. Pass --apply to write.
//
//   node --env-file-if-exists=/vercel/share/.env.project scripts/fix-greenstyle-name-casing.mjs
//   node --env-file-if-exists=/vercel/share/.env.project scripts/fix-greenstyle-name-casing.mjs --apply

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const APPLY = process.argv.includes("--apply")
const DESIGNER_ID = 57
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

// Tokens that must render fully uppercase.
const UPPER = new Set(["PDF", "XXS", "XS", "XL", "XXL", "2XL", "3XL", "4XL", "5XL", "3R", "UK", "US", "A0", "A4"])
// Lowercase inside a title, unless it is the first or last word.
const SMALL = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"])

const stripPunct = (s) => s.replace(/[^\p{L}\p{N}]/gu, "")

function fixToken(token, isEdge) {
  const bare = stripPunct(token)
  if (!bare) return token
  if (UPPER.has(bare.toUpperCase())) return token.replace(bare, bare.toUpperCase())
  if (!isEdge && SMALL.has(bare.toLowerCase())) return token.toLowerCase()
  return token
}

function repairCasing(name) {
  const words = name.split(/\s+/)
  return words
    .map((word, i) => {
      const isEdge = i === 0 || i === words.length - 1
      return word
        .split("-")
        .map((part, j) => fixToken(part, isEdge && j === 0))
        .join("-")
    })
    .join(" ")
}

const normUrl = (u) => {
  try {
    const x = new URL(u)
    return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase()
  } catch {
    return (u || "").toLowerCase()
  }
}

async function fetchStoreTitles() {
  const byUrl = new Map()
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://greenstyle.com/products.json?limit=250&page=${page}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) break
    const products = (await res.json()).products ?? []
    if (products.length === 0) break
    for (const p of products) {
      byUrl.set(normUrl(`https://greenstyle.com/products/${p.handle}`), (p.title ?? "").replace(/\s+/g, " ").trim())
    }
  }
  return byUrl
}

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

try {
  const store = await fetchStoreTitles()
  const rows = await prisma.pattern.findMany({
    where: { designer_id: DESIGNER_ID },
    select: { id: true, name: true, url: true },
    orderBy: { id: "asc" },
  })

  const casingOnly = []
  const wordingRepairs = []
  let identical = 0
  let unmatched = 0

  for (const row of rows) {
    const storeTitle = store.get(normUrl(row.url))
    if (!storeTitle) {
      unmatched++
      continue
    }
    if (storeTitle === row.name) {
      identical++
      continue
    }
    if (storeTitle.toLowerCase() === row.name.toLowerCase()) {
      casingOnly.push({ id: row.id, from: row.name, to: storeTitle })
    } else {
      const repaired = repairCasing(row.name)
      if (repaired !== row.name) wordingRepairs.push({ id: row.id, from: row.name, to: repaired })
    }
  }

  console.log(
    `rows=${rows.length} casingOnly=${casingOnly.length} wordingRepairs=${wordingRepairs.length} identical=${identical} unmatched=${unmatched}`,
  )

  console.log("\n=== WORDING-PRESERVING REPAIRS (derived from each row's own text) ===")
  for (const d of wordingRepairs) console.log(` [${d.id}]\n   from: ${d.from}\n     to: ${d.to}`)

  // A name collision inside one designer would signal the rules are wrong.
  const finals = new Map()
  for (const d of [...casingOnly, ...wordingRepairs]) {
    const key = d.to.toLowerCase()
    if (!finals.has(key)) finals.set(key, [])
    finals.get(key).push(d.id)
  }
  const collisions = [...finals.entries()].filter(([, ids]) => ids.length > 1)
  console.log(`\ncollisions among new names: ${collisions.length}`)
  for (const [k, ids] of collisions) console.log(`  ${k} <- ids ${ids.join(", ")}`)

  console.log("\n=== CASING-ONLY sample (first 10) ===")
  for (const d of casingOnly.slice(0, 10)) console.log(` [${d.id}] ${d.from}\n     -> ${d.to}`)

  if (!APPLY) {
    console.log("\nDRY RUN -- nothing written. Re-run with --apply to write.")
  } else if (collisions.length > 0) {
    console.log("\nABORTED: name collisions detected, refusing to write.")
  } else {
    const updates = [...casingOnly, ...wordingRepairs]
    let written = 0
    for (let start = 0; start < updates.length; start += 25) {
      const batch = updates.slice(start, start + 25)
      await prisma.$transaction(batch.map((d) => prisma.pattern.update({ where: { id: d.id }, data: { name: d.to } })))
      written += batch.length
    }
    console.log(`\nAPPLIED: ${written} rows updated.`)
  }
} catch (error) {
  console.log("ERR", error.message)
} finally {
  await prisma.$disconnect()
  await pool.end()
}
