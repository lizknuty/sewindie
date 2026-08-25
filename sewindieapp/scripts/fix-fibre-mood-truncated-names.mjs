// Fibre Mood rows whose name was stored truncated with a trailing ellipsis:
// "Amelia Jumpsuit Digital..." instead of "Amelia Jumpsuit Digital Pattern".
// These are user-visible titles, so this is the most conservative of the
// Fibre Mood repairs.
//
// It deliberately does NOT copy the upstream store title. Doing that looked
// attractive but degrades the catalogue in two ways:
//
//   - casing. The store writes "Celia girl Dress" and "Giti mobile phone bag";
//     the catalogue is consistently Title Case. Copying upstream would push
//     lowercase words into 57 visible titles.
//   - doubled suffix. The store titles a knitting product "Monica Maxi
//     Pullover Knitting Pattern" and then adds a "Digital" variant, so the
//     upstream-derived name becomes "Monica Maxi Pullover Knitting Pattern
//     Digital Pattern", with "Pattern" twice.
//
// Instead the truncation is COMPLETED locally. Every one of these names was
// cut inside the fixed "<Digital|Paper> Pattern" suffix the catalogue already
// uses everywhere, so the missing text is recoverable without inventing
// anything: the row keeps its own casing and only gains the characters the
// truncation removed.
//
// The store is still consulted, but only as a CHECK: a rename is allowed only
// when a real product backs it. That keeps the script from "completing" a name
// for a product that no longer exists.
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/fix-fibre-mood-truncated-names.mjs           # preview
//   node scripts/fix-fibre-mood-truncated-names.mjs --apply   # write

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

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

const baseTitle = (title) =>
  title
    .replace(/\s*sewing\s*pattern\b/gi, " ")
    .replace(/\s*knitting\s*pattern\b/gi, " ")
    .replace(/\s*\(\s*[A-Z]{1,2}-family[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

const stripEllipsis = (name) => name.trim().replace(/(?:\.{3}|\u2026)+\s*$/, "").trim()
const isTruncated = (name) => /(?:\.{3}|\u2026)\s*$/.test(name.trim())

// The garment name with the catalogue's format/craft words removed, used to
// confirm the store still carries this design.
const garmentKey = (name) =>
  normalize(
    stripEllipsis(name)
      .replace(/\b(digital|paper|knitting|crochet|sewing)\b/gi, " ")
      .replace(/\bpattern\b/gi, " "),
  )

async function fetchProducts() {
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
  return all
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const products = await fetchProducts()

    // garment -> which formats the store actually sells, for the check below.
    const storeFormats = new Map()
    for (const product of products) {
      const gKey = normalize(
        baseTitle(product.title).replace(/\b(digital|paper|pattern)\b/gi, " "),
      )
      if (gKey.length < 3) continue
      if (!storeFormats.has(gKey)) storeFormats.set(gKey, new Set())
      for (const variant of product.variants ?? []) {
        const format = (variant.title ?? "").trim()
        if (format === "Digital" || format === "Paper") storeFormats.get(gKey).add(format)
      }
    }

    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    })
    const truncated = rows.filter((r) => isTruncated(r.name))

    // Names already present in the catalogue, so a completion cannot collide
    // with an existing row.
    const existingNames = new Map()
    rows.forEach((r) => existingNames.set(normalize(r.name), r.id))

    const completions = []
    const needsFormat = []
    const notInStore = []
    const collides = []

    for (const row of truncated) {
      const stem = stripEllipsis(row.name)
      const gKey = garmentKey(row.name)
      const formats = storeFormats.get(gKey)

      // Tier 1: the truncation cut inside "<Digital|Paper> Pattern", so the
      // trailing format word is still present and the completion is certain.
      const m = stem.match(/\b(Digital|Paper)$/i)
      if (!m) {
        // Truncated before the format word: "Monica Maxi Pullover...". The
        // format cannot be recovered from the row itself, so this is reported
        // rather than guessed.
        needsFormat.push({ row, stem, storeFormats: formats ? [...formats] : [] })
        continue
      }

      if (!formats || formats.size === 0) {
        notInStore.push({ row, gKey })
        continue
      }
      const declared = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
      if (!formats.has(declared)) {
        notInStore.push({ row, gKey, reason: `store has ${[...formats].join("/")}, row says ${declared}` })
        continue
      }

      const to = `${stem} Pattern`
      const clash = existingNames.get(normalize(to))
      if (clash && clash !== row.id) {
        collides.push({ row, to, clashWith: clash })
        continue
      }
      completions.push({ id: row.id, from: row.name, to })
    }

    console.log(`designer ${DESIGNER_ID}: ${rows.length} rows, ${truncated.length} truncated names\n`)
    console.log(`  safe to complete locally     : ${completions.length}`)
    console.log(`  truncated before format word : ${needsFormat.length}  (skipped, needs a decision)`)
    console.log(`  design not in store          : ${notInStore.length}  (skipped)`)
    console.log(`  would collide with an existing name : ${collides.length}  (skipped)`)

    console.log(`\n=== all ${completions.length} completions ===`)
    completions.forEach((c) => console.log(`  [${c.id}] ${c.from}\n           -> ${c.to}`))

    if (needsFormat.length > 0) {
      console.log(`\n=== truncated before the format word (${needsFormat.length}, skipped) ===`)
      needsFormat.forEach((n) =>
        console.log(
          `  [${n.row.id}] ${n.row.name}\n        stem="${n.stem}" store sells: ${n.storeFormats.join("/") || "(design not found)"}`,
        ),
      )
    }
    if (notInStore.length > 0) {
      console.log(`\n=== design not in store (${notInStore.length}, skipped) ===`)
      notInStore.forEach((n) =>
        console.log(`  [${n.row.id}] ${n.row.name}  ${n.reason ?? `no store design for "${n.gKey}"`}`),
      )
    }
    if (collides.length > 0) {
      console.log(`\n=== name collisions (${collides.length}, skipped) ===`)
      collides.forEach((c) => console.log(`  [${c.row.id}] -> "${c.to}" already used by row ${c.clashWith}`))
    }

    // Sanity: every completion must only ADD characters to the stored name.
    const notPurelyAdditive = completions.filter((c) => !c.to.startsWith(stripEllipsis(c.from)))
    console.log(`\ncompletions that change existing characters: ${notPurelyAdditive.length} (must be 0)`)
    notPurelyAdditive.forEach((c) => console.log(`  [${c.id}] ${c.from} -> ${c.to}`))

    if (!APPLY) {
      console.log(`\nDRY RUN - nothing written. ${completions.length} names would be completed.`)
      console.log("Re-run with --apply to write.")
      return
    }
    if (notPurelyAdditive.length > 0) {
      console.log("\nABORTED: a completion would alter existing characters. No rows written.")
      process.exitCode = 1
      return
    }

    let written = 0
    for (let i = 0; i < completions.length; i += BATCH) {
      const slice = completions.slice(i, i + BATCH)
      await prisma.$transaction(
        slice.map((c) => prisma.pattern.update({ where: { id: c.id }, data: { name: c.to } })),
      )
      written += slice.length
      console.log(`  wrote ${written}/${completions.length}`)
    }
    console.log(`\nDone. ${written} names completed.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
