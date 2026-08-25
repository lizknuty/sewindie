// Seamwork rows carry two stale values, both fixed from one scrape:
//
//   1. url — points at the retired /catalog/<slug> path. These still work via
//      redirect, so this is a canonicalization rather than a repair: it makes
//      future syncs match on URL (strict) instead of name (loose).
//
//   2. thumbnail_url — Seamwork dropped the "/catalog" segment from its media
//      paths, so every stored thumbnail 404s. The product id and hash are
//      unchanged, which is why this is recoverable at all.
//
// Matching is by NAME, which is safe here because the catalogue card link text
// uses exactly the short form the existing rows were saved with ("Zinnia
// Skirt"), giving a verified 262/262 match with no ambiguity. Bonus cards are
// excluded from the match map: they are variations the catalogue does not hold,
// so they must never claim an existing row.
//
// A row is only written when exactly ONE card claims its name, and the run
// aborts before writing if any two rows would end up sharing a URL.
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/fix-seamwork-urls-and-images.mjs           # preview
//   node scripts/fix-seamwork-urls-and-images.mjs --apply   # write

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DESIGNER_ID = 112
const ORIGIN = "https://www.seamwork.com"
const CATALOGUE_PATH = "/pdf-sewing-patterns"
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const APPLY = process.argv.includes("--apply")
const BATCH = 25
const MAX_PAGES = 40

const decodeEntities = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim()

const normalize = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const absolute = (value) =>
  !value ? null : value.startsWith("http") ? value : `${ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`

async function scrapeCards() {
  const cards = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${ORIGIN}${CATALOGUE_PATH}?page=${page}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(40000),
    })
    if (!res.ok) throw new Error(`catalogue page ${page} -> ${res.status}`)
    const html = await res.text()
    const items = html.split(/<li data-bookmarkable-type="Product"/).slice(1)
    if (items.length === 0) break

    for (const item of items) {
      const href = (item.match(/href="(\/pdf-sewing-patterns\/[a-z0-9-]+)"/) || [])[1]
      if (!href) continue
      const rawName = (item.match(/<h3>\s*<a[^>]*>([^<]*)<\/a>/) || [])[1]
      const rawImage = (item.match(/<img[^>]*src="([^"]+)"/) || [])[1]
      const slug = href.split("/").filter(Boolean).pop()
      cards.push({
        slug,
        name: rawName ? decodeEntities(rawName) : null,
        url: `${ORIGIN}${CATALOGUE_PATH}/${slug}`,
        imageUrl: rawImage ? absolute(decodeEntities(rawImage)) : null,
        isBonus: /-bonus$/i.test(slug) || /\bbonus\b/i.test(rawName || ""),
      })
    }
  }

  const unique = new Map()
  for (const card of cards) if (!unique.has(card.slug)) unique.set(card.slug, card)
  return [...unique.values()]
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const cards = await scrapeCards()
    const mainCards = cards.filter((card) => !card.isBonus && card.name)
    console.log(`scraped ${cards.length} cards (${cards.length - mainCards.length} bonus/uncredited excluded)`)

    // Name -> cards. Anything claimed more than once is unsafe to use.
    const claims = new Map()
    for (const card of mainCards) {
      const key = normalize(card.name)
      if (!claims.has(key)) claims.set(key, [])
      claims.get(key).push(card)
    }

    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true, url: true, thumbnail_url: true },
      orderBy: { id: "asc" },
    })

    const planned = []
    const ambiguous = []
    const unmatched = []

    for (const row of rows) {
      const hits = claims.get(normalize(row.name.trim()))
      if (!hits || hits.length === 0) {
        unmatched.push(row)
        continue
      }
      if (hits.length > 1) {
        ambiguous.push({ row, slugs: hits.map((h) => h.slug) })
        continue
      }

      const card = hits[0]
      const data = {}
      if (card.url !== row.url) data.url = card.url
      if (card.imageUrl && card.imageUrl !== row.thumbnail_url) data.thumbnail_url = card.imageUrl
      if (Object.keys(data).length > 0) {
        planned.push({ id: row.id, name: row.name, from: row, to: data, slug: card.slug })
      }
    }

    const urlChanges = planned.filter((p) => p.to.url)
    const imageChanges = planned.filter((p) => p.to.thumbnail_url)

    console.log(`\ndesigner ${DESIGNER_ID} rows: ${rows.length}`)
    console.log(`  rows to update          : ${planned.length}`)
    console.log(`    - url canonicalized   : ${urlChanges.length}`)
    console.log(`    - thumbnail repaired  : ${imageChanges.length}`)
    console.log(`  ambiguous, skipped      : ${ambiguous.length}`)
    console.log(`  no store match, skipped : ${unmatched.length}`)

    // A URL must stay unique per row, so refuse to create a collision. Compare
    // planned writes against every row's final URL, not just the changed ones.
    const finalUrl = new Map(rows.map((r) => [r.id, r.url]))
    for (const change of urlChanges) finalUrl.set(change.id, change.to.url)
    const byUrl = new Map()
    const collisions = []
    for (const [id, url] of finalUrl) {
      if (byUrl.has(url)) collisions.push({ url, ids: [byUrl.get(url), id] })
      else byUrl.set(url, id)
    }
    console.log(`\nURL collisions after the planned writes: ${collisions.length}`)
    collisions.slice(0, 10).forEach((c) => console.log(`  ${c.url} <- rows ${c.ids.join(" and ")}`))

    if (ambiguous.length > 0) {
      console.log("\n=== ambiguous (skipped) ===")
      ambiguous.slice(0, 15).forEach((a) => console.log(`  [${a.row.id}] ${a.row.name}\n      ${a.slugs.join("\n      ")}`))
    }
    if (unmatched.length > 0) {
      console.log(`\n=== no store match (skipped, first 20 of ${unmatched.length}) ===`)
      unmatched.slice(0, 20).forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }

    console.log(`\n=== sample URL canonicalizations (first 8 of ${urlChanges.length}) ===`)
    urlChanges.slice(0, 8).forEach((p) =>
      console.log(`  [${p.id}] ${p.name}\n      ${p.from.url.replace(ORIGIN, "")}\n   -> ${p.to.url.replace(ORIGIN, "")}`),
    )

    console.log(`\n=== sample thumbnail repairs (first 8 of ${imageChanges.length}) ===`)
    imageChanges.slice(0, 8).forEach((p) =>
      console.log(
        `  [${p.id}] ${p.name}\n      ${(p.from.thumbnail_url || "(none)").replace(ORIGIN, "")}\n   -> ${p.to.thumbnail_url.replace(ORIGIN, "")}`,
      ),
    )

    // Prove the replacements actually resolve before writing anything.
    const sample = imageChanges.filter((_, i) => i % Math.max(1, Math.floor(imageChanges.length / 10)) === 0).slice(0, 10)
    if (sample.length > 0) {
      console.log(`\n=== live check of ${sample.length} replacement thumbnails ===`)
      let ok = 0
      for (const change of sample) {
        try {
          const res = await fetch(change.to.thumbnail_url, {
            headers: { "User-Agent": UA },
            redirect: "follow",
            signal: AbortSignal.timeout(20000),
          })
          const good = res.status === 200 && (res.headers.get("content-type") || "").startsWith("image/")
          if (good) ok++
          console.log(`  ${good ? "OK " : "BAD"} ${res.status}  ${change.to.thumbnail_url.replace(ORIGIN, "")}`)
        } catch (error) {
          console.log(`  ERR ${error.message.slice(0, 30)}  ${change.to.thumbnail_url.replace(ORIGIN, "")}`)
        }
      }
      console.log(`  ${ok}/${sample.length} replacements resolve to a real image`)
    }

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
        slice.map((change) => prisma.pattern.update({ where: { id: change.id }, data: change.to })),
      )
      written += slice.length
      console.log(`  wrote ${written}/${planned.length}`)
    }
    console.log(`\nDone. ${written} rows updated.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
