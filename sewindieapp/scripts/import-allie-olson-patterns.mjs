// Import Allie Olson Sewing Patterns (designer_id 4) from the store's
// digital-patterns collection.
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/import-allie-olson-patterns.mjs           # preview
//   node scripts/import-allie-olson-patterns.mjs --apply   # write
//
// Source of truth is the Shopify collection the designer publishes:
// allieolson.com/collections/digital-patterns. That endpoint returns
// structured JSON, so nothing here parses HTML.
//
// Scope: the collection holds 11 products. The wider store holds 18, but the
// extra 7 are in-person basketry/weaving workshops and a pair of earrings, so
// the collection is exactly the right boundary and is used verbatim.
//
// CATEGORIES DELIBERATELY IGNORE THE STORE'S OWN TAGS. Allie Olson tags
// Monarch Jacket, Neffy Cardigan, Hive Pullover and Lonetree Jacket and Vest
// all as "Tops", but this catalogue's established convention is driven by the
// garment noun in the title:
//
//   cardigan -> Sweater / Sweatshirt  135 of 136 existing rows
//   pullover -> Sweater / Sweatshirt   78 of  79
//   jacket   -> Coat / Jacket         301
//   vest     -> Vest                   99
//   tank     -> Tops                  117
//   jeans    -> Pants / Jeans          45
//   skirt    -> Skirt                 394
//
// Following the tags instead would have miscategorised 3 of the 11 against
// every comparable row already in the table: Monarch Jacket, Neffy Cardigan and
// Lonetree Jacket and Vest are all tagged only "Tops" upstream. Hive Pullover
// is a fourth row that disagrees with the tags in effect, but for a different
// reason -- the store gives it no tags at all, so there is nothing to override.
// Coarser-but-consistent tags ("Bottoms" on Buttress Jeans) are not overrides
// and are not reported as such.
//
// release_date comes from Shopify's published_at, but only where that value is
// trustworthy. It is not trustworthy everywhere: Kila Tank, Highlands Wrap
// Dress and Coram Top and Dress all share 2019-11-22T10:57:11 to the second,
// and Monarch Jacket and Lonetree Jacket and Vest share 2019-11-25T18:21:38.
// Three distinct designs cannot have been released in the same second, so those
// stamps record a bulk store migration, not a release.
//
// Rather than hardcode which handles to skip, the rule is derived from the data:
// group the collection by published_at, and treat any timestamp claimed by more
// than one product as an artifact. That leaves 6 dated rows and 5 nulls, and it
// self-corrects if the store re-publishes or adds patterns later.
//
// Caveat this rule cannot settle: Weaver Skirt and Hive Pullover are 51 seconds
// apart on 2023-08-31. Distinct stamps, so both are accepted, but that gap is
// short enough to be one bulk action rather than two releases. Reported as a
// near-collision so the pair can be reviewed rather than silently trusted.
//
// difficulty and yardage are left null: they are populated on 3 and 1 rows
// respectively out of 9458 catalogue-wide, and the product descriptions carry
// no structured value for either.

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

const APPLY = process.argv.includes("--apply")

const DESIGNER_ID = 4
const COLLECTION = "https://allieolson.com/collections/digital-patterns/products.json?limit=250"
const PRODUCT_BASE = "https://www.allieolson.com/products/"
const LANGUAGE = "English"
const AUDIENCE = "Women"
const FORMAT = "PDF"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"

// Which store tags are CONSISTENT with which catalogue categories. Used only
// for reporting, to separate a tag that genuinely contradicts the assigned
// category from one that is merely coarser. "Bottoms" on Buttress Jeans is a
// parent of "Pants / Jeans" and agrees with it; "Tops" on Monarch Jacket does
// not. Without this distinction the report flags harmless coarse tags as
// overrides and the flag stops being worth reading.
const TAG_COMPATIBLE = {
  bottoms: ["Pants / Jeans", "Skirt", "Shorts"],
  tops: ["Tops"],
  dresses: ["Dress"],
  skirts: ["Skirt"],
  outerwear: ["Coat / Jacket", "Vest"],
}

function overrideNote(row) {
  if (row.storeTags === "(none)") return "   (store has no tags for this product)"
  const tags = row.storeTags.split(",").map((t) => t.trim().toLowerCase())
  const anyAgrees = tags.some((t) => (TAG_COMPATIBLE[t] ?? []).some((c) => row.cats.includes(c)))
  return anyAgrees ? "" : "   <-- contradicts store tag, see header"
}

// Ordered garment-noun rules. Every rule is backed by the existing convention
// counts quoted above. Longer/more specific nouns must precede shorter ones so
// "wrap dress" is not shadowed by "dress", and a title can legitimately match
// several rules ("Coram Top and Dress", "Lonetree Jacket and Vest").
const CATEGORY_RULES = [
  { test: /\bjeans\b/i, category: "Pants / Jeans" },
  { test: /\bpants\b/i, category: "Pants / Jeans" },
  { test: /\bcardigan\b/i, category: "Sweater / Sweatshirt" },
  { test: /\bpullover\b/i, category: "Sweater / Sweatshirt" },
  { test: /\bjacket\b/i, category: "Coat / Jacket" },
  { test: /\bvest\b/i, category: "Vest" },
  { test: /\bskirt\b/i, category: "Skirt" },
  { test: /\bdress\b/i, category: "Dress" },
  { test: /\btank\b/i, category: "Tops" },
  { test: /\btop\b/i, category: "Tops" },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A 429 means "too fast", not "gone". Retry transient statuses with backoff so
// the guard never mistakes throttling for a dead target.
async function headOk(url, attempt = 0) {
  const MAX = 4
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) })
    if ((res.status === 429 || res.status >= 500) && attempt < MAX) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt)
      return headOk(url, attempt + 1)
    }
    return { status: res.status, attempts: attempt + 1 }
  } catch (error) {
    if (attempt < MAX) {
      await sleep(2000 * 2 ** attempt)
      return headOk(url, attempt + 1)
    }
    return { status: 0, attempts: attempt + 1, error: error.message }
  }
}

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const designer = await prisma.designer.findUnique({
    where: { id: DESIGNER_ID },
    select: { id: true, name: true, url: true },
  })
  if (!designer) {
    console.log(`ABORTED: designer ${DESIGNER_ID} not found. No rows written.`)
    process.exitCode = 1
    return
  }
  console.log(`designer: [${designer.id}] ${designer.name}`)
  console.log(`mode    : ${APPLY ? "APPLY (writes)" : "DRY RUN (no writes)"}\n`)

  // ---- source ----------------------------------------------------------
  const res = await fetch(COLLECTION, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) {
    console.log(`ABORTED: collection fetch returned ${res.status}. No rows written.`)
    process.exitCode = 1
    return
  }
  const products = (await res.json()).products ?? []
  console.log(`source products in digital-patterns: ${products.length}`)
  if (products.length === 0) {
    console.log("ABORTED: source returned no products. No rows written.")
    process.exitCode = 1
    return
  }

  // ---- which published_at values are real releases ---------------------
  // A timestamp shared by two or more distinct designs records a bulk store
  // action, not a release, so it is discarded rather than written.
  const stampCount = new Map()
  for (const p of products) {
    stampCount.set(p.published_at, (stampCount.get(p.published_at) ?? 0) + 1)
  }
  const releaseDateFor = (p) =>
    stampCount.get(p.published_at) === 1 && p.published_at ? new Date(p.published_at) : null

  const shared = [...stampCount.entries()].filter(([, n]) => n > 1)
  console.log(`\n=== published_at triage ===`)
  console.log(`  distinct stamps           : ${stampCount.size}`)
  console.log(`  bulk stamps (-> null)     : ${shared.length} covering ${shared.reduce((a, [, n]) => a + n, 0)} products`)
  shared.forEach(([stamp, n]) => {
    const titles = products.filter((p) => p.published_at === stamp).map((p) => p.title)
    console.log(`    ${stamp}  x${n}: ${titles.join(", ")}`)
  })

  // Distinct but suspiciously close stamps are still accepted -- they are
  // genuinely different values -- but they are surfaced rather than trusted
  // silently, since a sub-minute gap can also mean one bulk action.
  const dated = products.filter((p) => stampCount.get(p.published_at) === 1)
  const NEAR_MS = 5 * 60 * 1000
  const near = []
  const sorted = [...dated].sort((a, b) => new Date(a.published_at) - new Date(b.published_at))
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].published_at) - new Date(sorted[i - 1].published_at)
    if (gap <= NEAR_MS) {
      near.push(`${sorted[i - 1].title} and ${sorted[i].title} (${Math.round(gap / 1000)}s apart)`)
    }
  }
  if (near.length > 0) {
    console.log(`  near-collisions (accepted, review): ${near.length}`)
    near.forEach((n) => console.log(`    ${n}`))
  }

  // ---- vocabularies (resolved by name, never hardcoded ids) ------------
  const [categories, audiences, formats] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.audience.findMany({ select: { id: true, name: true } }),
    prisma.format.findMany({ select: { id: true, name: true } }),
  ])
  const catId = new Map(categories.map((c) => [c.name, c.id]))
  const audId = new Map(audiences.map((a) => [a.name, a.id]))
  const fmtId = new Map(formats.map((f) => [f.name, f.id]))

  const missingVocab = [
    ...new Set(CATEGORY_RULES.map((r) => r.category)),
  ].filter((name) => !catId.has(name))
  if (missingVocab.length > 0 || !audId.has(AUDIENCE) || !fmtId.has(FORMAT)) {
    console.log(
      `ABORTED: vocabulary missing. categories=${missingVocab.join(", ") || "ok"} audience=${audId.has(AUDIENCE)} format=${fmtId.has(FORMAT)}. No rows written.`,
    )
    process.exitCode = 1
    return
  }

  // ---- existing rows (idempotency) -------------------------------------
  const existing = await prisma.pattern.findMany({
    where: { designer_id: DESIGNER_ID },
    select: { id: true, name: true, url: true },
  })
  const byUrl = new Map(existing.map((p) => [p.url, p]))
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]))
  console.log(`existing patterns for this designer: ${existing.length}\n`)

  const planned = []
  const skipped = []
  const refused = []

  for (const product of products) {
    const name = (product.title ?? "").trim()
    const url = `${PRODUCT_BASE}${product.handle}`
    const image = product.images?.[0]?.src ?? null

    if (!name) {
      refused.push({ name: product.handle, reason: "product has no title" })
      continue
    }
    if (!image) {
      refused.push({ name, reason: "product has no image" })
      continue
    }

    // Re-running must not double-insert: Pattern has no unique constraint on
    // (designer_id, name), so the guard is explicit rather than relying on the
    // database to reject it.
    const dupe = byUrl.get(url) ?? byName.get(name.toLowerCase())
    if (dupe) {
      skipped.push({ name, reason: `already present as row ${dupe.id}` })
      continue
    }

    const cats = [...new Set(CATEGORY_RULES.filter((r) => r.test.test(name)).map((r) => r.category))]
    if (cats.length === 0) {
      // Better to leave it out and report than to insert an uncategorised row
      // that silently never appears under any filter.
      refused.push({ name, reason: "no garment noun matched, would be uncategorised" })
      continue
    }

    const storeTags = (product.tags ?? []).join(", ") || "(none)"
    planned.push({
      name,
      url,
      image,
      cats,
      storeTags,
      handle: product.handle,
      releaseDate: releaseDateFor(product),
    })
  }

  // ---- report ----------------------------------------------------------
  console.log(`=== plan ===`)
  console.log(`  to import : ${planned.length}`)
  console.log(`  skipped   : ${skipped.length} (already present)`)
  console.log(`  refused   : ${refused.length}`)

  console.log(`\n=== mapping (all ${planned.length}, store tags shown for comparison) ===`)
  for (const row of planned) {
    console.log(`  ${row.name}`)
    console.log(`      category : ${row.cats.join(" + ")}`)
    console.log(`      store tag: ${row.storeTags}${overrideNote(row)}`)
    console.log(
      `      released : ${row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : "null (bulk stamp)"}`,
    )
    console.log(`      url      : ${row.url}`)
    console.log(`      image    : ${row.image}`)
  }

  if (skipped.length > 0) {
    console.log(`\n=== skipped (${skipped.length}) ===`)
    skipped.forEach((s) => console.log(`  ${s.name} - ${s.reason}`))
  }
  if (refused.length > 0) {
    console.log(`\n=== refused (${refused.length}) ===`)
    refused.forEach((r) => console.log(`  ${r.name} - ${r.reason}`))
  }

  if (planned.length === 0) {
    console.log(`\nNothing to import. No rows written.`)
    return
  }

  // ---- live check ------------------------------------------------------
  console.log(`\n=== live check: ${planned.length * 2} targets (url + image per pattern) ===`)
  let bad = 0
  let throttled = 0
  for (const row of planned) {
    for (const target of [row.url, row.image]) {
      const probe = await headOk(target)
      const ok = probe.status === 200
      if (!ok) bad++
      if (probe.status === 429) throttled++
      const retries = probe.attempts > 1 ? ` (after ${probe.attempts} attempts)` : ""
      console.log(`  ${ok ? "ok " : "BAD"} ${probe.status}  ${target}${retries}`)
      await sleep(350)
    }
  }
  if (bad > 0) {
    console.log(`\nABORTED: ${bad} target(s) did not resolve. No rows written.`)
    if (throttled > 0) {
      console.log(
        `  ${throttled} were HTTP 429 after backoff, which reflects request pacing rather than\n` +
          `  a missing product. Wait and re-run.`,
      )
    }
    process.exitCode = 1
    return
  }
  console.log(`  all ${planned.length * 2} targets resolved`)

  if (!APPLY) {
    console.log(`\nDRY RUN: would import ${planned.length} patterns for designer ${DESIGNER_ID}.`)
    console.log(`Each would get category as mapped above, audience "${AUDIENCE}", format "${FORMAT}",`)
    const withDate = planned.filter((r) => r.releaseDate).length
    console.log(
      `language "${LANGUAGE}", release_date on ${withDate} of ${planned.length} (${planned.length - withDate} bulk-stamped rows stay null),`,
    )
    console.log(`and null difficulty/yardage (see header).`)
    console.log(`Re-run with --apply to write.`)
    return
  }

  // ---- write -----------------------------------------------------------
  let written = 0
  for (const row of planned) {
    await prisma.$transaction(async (tx) => {
      const pattern = await tx.pattern.create({
        data: {
          name: row.name,
          designer_id: DESIGNER_ID,
          url: row.url,
          thumbnail_url: row.image,
          language: LANGUAGE,
          release_date: row.releaseDate,
        },
        select: { id: true },
      })
      await tx.patternCategory.createMany({
        data: row.cats.map((c) => ({ pattern_id: pattern.id, category_id: catId.get(c) })),
      })
      await tx.patternAudience.create({
        data: { pattern_id: pattern.id, audience_id: audId.get(AUDIENCE) },
      })
      await tx.patternFormat.create({
        data: { pattern_id: pattern.id, format_id: fmtId.get(FORMAT) },
      })
      written++
      console.log(`  wrote [${pattern.id}] ${row.name}`)
    })
  }

  console.log(`\nAPPLIED: imported ${written} of ${planned.length} patterns.`)

  const after = await prisma.pattern.count({ where: { designer_id: DESIGNER_ID } })
  console.log(`designer ${DESIGNER_ID} now has ${after} patterns.`)
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
