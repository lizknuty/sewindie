// Fibre Mood migrated from PrestaShop (shop.fibremood.com) to Shopify
// (www.fibremood.com). The old host is entirely dead, so every catalogue row
// for this designer currently links nowhere. This re-points the rows we can
// confidently match to their new Shopify product URL.
//
// Matching is by NAME, because the old URLs share no structure with the new
// ones. To keep that safe:
//   - the scraped name is rebuilt as "<base> <Digital|Paper> Pattern", the
//     exact convention the existing 839 rows already use
//   - a row is only updated when exactly ONE store variant claims it, so an
//     ambiguous name is skipped rather than guessed
//   - rows whose truncated name ("Amelia Jumpsuit Digital...") can be matched
//     by prefix are reported separately, since fixing those means also
//     restoring the full name
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/fix-fibre-mood-dead-urls.mjs           # preview
//   node scripts/fix-fibre-mood-dead-urls.mjs --apply   # write

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DESIGNER_ID = 43
const STORE = "https://www.fibremood.com"
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const APPLY = process.argv.includes("--apply")
const BATCH = 25

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

// Same title cleanup the fibre-mood adapter uses, kept in sync deliberately.
const baseTitle = (title) =>
  title
    .replace(/\s*sewing\s*pattern\b/gi, " ")
    .replace(/\s*\(\s*[A-Z]{1,2}-family[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

async function fetchPatterns() {
  const all = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${STORE}/products.json?limit=250&page=${page}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`products.json page ${page} -> ${res.status}`)
    const batch = (await res.json()).products ?? []
    if (batch.length === 0) break
    all.push(...batch)
  }
  return all.filter((product) => product.product_type === "Pattern")
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const products = await fetchPatterns()

    // Build name -> candidate URLs. Anything claimed more than once is unsafe.
    const claims = new Map()
    for (const product of products) {
      const base = baseTitle(product.title)
      for (const variant of product.variants ?? []) {
        const format = (variant.title ?? "").trim()
        if (format !== "Digital" && format !== "Paper") continue
        const key = normalize(`${base} ${format} Pattern`)
        const url = `${STORE}/products/${product.handle}?variant=${variant.id}`
        if (!claims.has(key)) claims.set(key, new Set())
        claims.get(key).add(url)
      }
    }

    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true, url: true },
      orderBy: { id: "asc" },
    })

    const updates = []
    const ambiguous = []
    const truncated = []
    const unmatched = []
    const alreadyLive = []

    for (const row of rows) {
      if (row.url?.includes("www.fibremood.com")) {
        alreadyLive.push(row)
        continue
      }

      const trimmed = row.name.trim()
      const isTruncated = /(?:\.{3}|\u2026)$/.test(trimmed)

      if (isTruncated) {
        const prefix = normalize(trimmed.replace(/(?:\.{3}|\u2026)+$/, ""))
        const hits = [...claims.entries()].filter(([key]) => prefix.length >= 8 && key.startsWith(prefix))
        if (hits.length === 1 && hits[0][1].size === 1) {
          truncated.push({ row, fullName: hits[0][0], url: [...hits[0][1]][0] })
        } else {
          unmatched.push(row)
        }
        continue
      }

      const candidates = claims.get(normalize(trimmed))
      if (!candidates) unmatched.push(row)
      else if (candidates.size > 1) ambiguous.push({ row, urls: [...candidates] })
      else updates.push({ id: row.id, name: row.name, from: row.url, to: [...candidates][0] })
    }

    console.log(`designer ${DESIGNER_ID} rows: ${rows.length}`)
    console.log(`  already on the live store : ${alreadyLive.length}`)
    console.log(`  safe to re-point          : ${updates.length}`)
    console.log(`  truncated name, 1 match   : ${truncated.length}  (URL only; name left as-is)`)
    console.log(`  ambiguous, skipped        : ${ambiguous.length}`)
    console.log(`  no store match, skipped   : ${unmatched.length}`)

    // A URL must stay unique per row, so refuse to create a collision.
    const seen = new Map()
    const collisions = []
    for (const change of [...updates, ...truncated.map((t) => ({ id: t.row.id, to: t.url }))]) {
      if (seen.has(change.to)) collisions.push({ url: change.to, ids: [seen.get(change.to), change.id] })
      else seen.set(change.to, change.id)
    }
    console.log(`\nURL collisions among planned writes: ${collisions.length}`)
    collisions.slice(0, 10).forEach((c) => console.log(`  ${c.url} <- rows ${c.ids.join(" and ")}`))

    if (ambiguous.length > 0) {
      console.log("\n=== ambiguous (skipped) ===")
      ambiguous.slice(0, 15).forEach((a) => console.log(`  [${a.row.id}] ${a.row.name}\n      ${a.urls.join("\n      ")}`))
    }

    if (unmatched.length > 0) {
      console.log(`\n=== no store match (skipped, first 20 of ${unmatched.length}) ===`)
      unmatched.slice(0, 20).forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }

    console.log(`\n=== sample re-points (first 12 of ${updates.length}) ===`)
    updates.slice(0, 12).forEach((u) => console.log(`  [${u.id}] ${u.name}\n      ${u.from}\n   -> ${u.to}`))

    if (truncated.length > 0) {
      console.log(`\n=== truncated rows getting a URL (first 12 of ${truncated.length}) ===`)
      truncated.slice(0, 12).forEach((t) => console.log(`  [${t.row.id}] ${t.row.name}\n   -> ${t.url}`))
    }

    const planned = [...updates, ...truncated.map((t) => ({ id: t.row.id, to: t.url }))]

    if (!APPLY) {
      console.log(`\nDRY RUN — nothing written. ${planned.length} rows would change.`)
      console.log("Re-run with --apply to write.")
      return
    }

    if (collisions.length > 0) {
      console.log("\nABORTED: URL collisions detected. No rows written.")
      process.exitCode = 1
      return
    }

    let written = 0
    for (let i = 0; i < planned.length; i += BATCH) {
      const slice = planned.slice(i, i + BATCH)
      await prisma.$transaction(
        slice.map((change) => prisma.pattern.update({ where: { id: change.id }, data: { url: change.to } })),
      )
      written += slice.length
      console.log(`  wrote ${written}/${planned.length}`)
    }
    console.log(`\nDone. ${written} rows re-pointed to the live store.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
