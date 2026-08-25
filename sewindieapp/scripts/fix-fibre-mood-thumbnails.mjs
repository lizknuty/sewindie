// Companion to fix-fibre-mood-dead-urls.mjs.
//
// That script re-pointed `url` from the dead PrestaShop host
// (shop.fibremood.com) to the live Shopify store, but it only touched `url`.
// Every `thumbnail_url` was left on the dead host, so all Fibre Mood cover
// images are still broken. This repairs them.
//
// Matching is by NAME, using the exact same "<base> <Digital|Paper> Pattern"
// key as the URL script, so the two stay consistent:
//   - a row is only updated when exactly ONE store product claims its name
//   - ambiguous names are skipped rather than guessed
//   - truncated names ("Amelia Jumpsuit Digital...") are matched by prefix,
//     longest-first, and only when a single product claims the prefix
//
// Unlike `url`, a thumbnail does NOT need to be unique: the Digital and Paper
// rows of one design are the same garment and legitimately share a cover
// photo. So there is no collision check here — instead the script reports how
// many distinct images it is about to write, and live-checks a sample to prove
// the replacements are real images rather than 404 pages.
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/fix-fibre-mood-thumbnails.mjs           # preview
//   node scripts/fix-fibre-mood-thumbnails.mjs --apply   # write

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DESIGNER_ID = 43
const STORE = "https://www.fibremood.com"
const DEAD_HOST = "shop.fibremood.com"
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const APPLY = process.argv.includes("--apply")
const BATCH = 25
const SAMPLE = 12

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

// Kept deliberately in sync with the fibre-mood adapter and the URL script.
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

async function checkImage(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    })
    return { status: res.status, type: res.headers.get("content-type") || "" }
  } catch (error) {
    return { status: 0, type: `ERR ${error.message}` }
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const products = await fetchPatterns()

    // name key -> set of candidate image urls (a product has one cover photo,
    // so a set larger than one means two different products claim the name).
    const claims = new Map()
    for (const product of products) {
      const image = product.images?.[0]?.src ?? null
      if (!image) continue
      const base = baseTitle(product.title)
      for (const variant of product.variants ?? []) {
        const format = (variant.title ?? "").trim()
        if (format !== "Digital" && format !== "Paper") continue
        const key = normalize(`${base} ${format} Pattern`)
        if (!claims.has(key)) claims.set(key, new Set())
        claims.get(key).add(image)
      }
    }

    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true, thumbnail_url: true },
      orderBy: { id: "asc" },
    })

    const updates = []
    const ambiguous = []
    const unmatched = []
    const alreadyLive = []
    const noThumb = []

    for (const row of rows) {
      const current = row.thumbnail_url ?? ""

      if (!current) {
        noThumb.push(row)
        continue
      }
      // Only touch rows still pointing at the dead host.
      if (!current.includes(DEAD_HOST)) {
        alreadyLive.push(row)
        continue
      }

      const trimmed = row.name.trim()
      const isTruncated = /(?:\.{3}|\u2026)$/.test(trimmed)

      let candidates = null
      if (isTruncated) {
        const prefix = normalize(trimmed.replace(/(?:\.{3}|\u2026)+$/, ""))
        if (prefix.length >= 8) {
          const hits = [...claims.entries()]
            .filter(([key]) => key.startsWith(prefix))
            .sort((a, b) => b[0].length - a[0].length)
          // Only safe when every hit agrees on the same image.
          if (hits.length > 0) {
            const images = new Set(hits.flatMap(([, set]) => [...set]))
            candidates = images
          }
        }
      } else {
        candidates = claims.get(normalize(trimmed)) ?? null
      }

      if (!candidates || candidates.size === 0) unmatched.push(row)
      else if (candidates.size > 1) ambiguous.push({ row, images: [...candidates] })
      else updates.push({ id: row.id, name: row.name, from: current, to: [...candidates][0] })
    }

    console.log(`designer ${DESIGNER_ID} rows: ${rows.length}`)
    console.log(`  thumbnail already on live store : ${alreadyLive.length}`)
    console.log(`  null/empty thumbnail, skipped   : ${noThumb.length}`)
    console.log(`  safe to repair                  : ${updates.length}`)
    console.log(`  ambiguous, skipped              : ${ambiguous.length}`)
    console.log(`  no store match, skipped         : ${unmatched.length}`)

    const distinct = new Set(updates.map((u) => u.to))
    console.log(`\ndistinct replacement images: ${distinct.size} for ${updates.length} rows`)
    console.log("  (Digital and Paper of one design share a cover photo, so fewer images than rows is expected)")

    const offHost = updates.filter((u) => {
      try {
        return !/(^|\.)shopify\.com$|(^|\.)fibremood\.com$/.test(new URL(u.to).hostname)
      } catch {
        return true
      }
    })
    console.log(`replacements on an unexpected host: ${offHost.length}`)
    offHost.slice(0, 5).forEach((u) => console.log(`  [${u.id}] ${u.to}`))

    if (ambiguous.length > 0) {
      console.log(`\n=== ambiguous (skipped, first 15 of ${ambiguous.length}) ===`)
      ambiguous
        .slice(0, 15)
        .forEach((a) => console.log(`  [${a.row.id}] ${a.row.name}\n      ${a.images.join("\n      ")}`))
    }

    if (unmatched.length > 0) {
      console.log(`\n=== no store match (skipped, first 20 of ${unmatched.length}) ===`)
      unmatched.slice(0, 20).forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }

    console.log(`\n=== sample repairs (first 10 of ${updates.length}) ===`)
    updates.slice(0, 10).forEach((u) => console.log(`  [${u.id}] ${u.name}\n      ${u.from}\n   -> ${u.to}`))

    // Prove the replacements are real images before writing anything.
    const pool2 = [...distinct]
    const sample = []
    while (pool2.length > 0 && sample.length < SAMPLE) {
      sample.push(pool2.splice(Math.floor(Math.random() * pool2.length), 1)[0])
    }
    console.log(`\n=== live check: ${sample.length} random replacement images ===`)
    let ok = 0
    for (const url of sample) {
      const res = await checkImage(url)
      const good = res.status === 200 && res.type.startsWith("image/")
      if (good) ok++
      console.log(`  ${good ? "OK " : "BAD"} ${res.status} ${res.type.padEnd(12)} ${url.slice(0, 78)}`)
    }
    console.log(`  ${ok}/${sample.length} resolve to a real image`)

    if (!APPLY) {
      console.log(`\nDRY RUN — nothing written. ${updates.length} rows would change.`)
      console.log("Re-run with --apply to write.")
      return
    }

    if (ok < sample.length) {
      console.log("\nABORTED: not every sampled replacement resolved to an image. No rows written.")
      process.exitCode = 1
      return
    }

    let written = 0
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH)
      await prisma.$transaction(
        slice.map((change) =>
          prisma.pattern.update({ where: { id: change.id }, data: { thumbnail_url: change.to } }),
        ),
      )
      written += slice.length
      console.log(`  wrote ${written}/${updates.length}`)
    }
    console.log(`\nDone. ${written} thumbnails repaired.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
