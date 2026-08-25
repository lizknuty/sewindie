// The last Fibre Mood rows still pointing at the dead shop.fibremood.com host,
// in both columns at once (they are the same rows, so splitting them would
// scrape the store twice and risk the two columns disagreeing):
//
//   issue 2 - url           still on the dead host
//   issue 1 - thumbnail_url still on the dead host
//
// Everything reachable by the earlier passes is already fixed, so what is left
// only resolves through two things the previous scripts did not use:
//
//   1. The store's PRODUCT HANDLE, not its title. Fibre Mood renamed several
//      products but kept the handle, so the handle still carries the original
//      name: "Sam Cardigan" is titled "Sammy Cardigan Knitting Pattern" but
//      still lives at /products/sam-cardigan-pdf-pattern. Title matching can
//      never see that; the handle makes it exact.
//
//   2. product_type "Magazine". The earlier scripts filtered to
//      product_type == "Pattern", which silently excluded "Pattern Book 30" --
//      a real product with a real cover image. That exclusion is why the
//      craft-agnostic tier previously matched it to a site banner.
//
// The handle rule is deliberately strict: the row's slug plus one known format
// suffix must equal the store handle exactly. That is what makes it safe, and
// it is what refuses the two tempting-but-wrong guesses the storefront search
// offers -- "Arlette Hack Skirt" -> "Arlette Skirt" and "Julia Jacket Long"
// -> "Julia Jacket" are different garments, and neither produces a matching
// handle, so both are skipped rather than silently mapped.
//
// Dry run by default. Pass --apply to write.
//
//   node scripts/fix-fibre-mood-dead-host-remnants.mjs           # preview
//   node scripts/fix-fibre-mood-dead-host-remnants.mjs --apply   # write

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const pg = require("pg")

const DESIGNER_ID = 43
const STORE = "https://www.fibremood.com"
const DEAD = "shop.fibremood.com"
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const APPLY = process.argv.includes("--apply")
const BATCH = 25

// Handle suffixes Fibre Mood appends to a garment slug. A candidate handle must
// be exactly "<slug>" or "<slug>-<one of these>".
const HANDLE_SUFFIXES = ["pod", "pdf-pattern", "digital-pattern", "paper-pattern", "pattern"]

// Editorial combos that pair two garments. No single product image is correct
// for them, so they are never matched, only reported.
const COMBO = /\bmix\s*(?:&|and)\s*match\b/i

// Fibre Mood product photos are named after the legacy asset id ("249_0.jpg",
// "5778.jpg"). The magazine products instead reuse a site-wide marketing
// banner, which is a wrong-but-plausible image: it loads fine and would pass a
// live check, so it has to be rejected by name. This is why "Pattern Book 30"
// gets its url repaired but keeps its old thumbnail rather than adopting a
// banner.
const GENERIC_IMAGE = /afbeeldingen|nieuwe-website|banner|placeholder|logo|header/i

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const slugify = (value) => normalize(value).replace(/\s+/g, "-")

const baseTitle = (title) =>
  title
    .replace(/\s*sewing\s*pattern\b/gi, " ")
    .replace(/\s*knitting\s*pattern\b/gi, " ")
    .replace(/\s*\(\s*[A-Z]{1,2}-family[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

const stripEllipsis = (name) => name.trim().replace(/(?:\.{3}|\u2026)+\s*$/, "").trim()

// Garment name with craft/format words stripped, used for the handle slug.
const garmentName = (name) =>
  stripEllipsis(name)
    .replace(/\b(digital|paper|knitting|crochet|sewing)\b/gi, " ")
    .replace(/\bpattern\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

const declaredFormat = (name) => {
  if (/\bpaper\b/i.test(name)) return "Paper"
  if (/\bdigital\b/i.test(name)) return "Digital"
  return null
}

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
  // Deliberately NOT filtered to product_type == "Pattern": magazines are real
  // catalogue rows too. Fabric and subscriptions are excluded instead.
  const EXCLUDE = new Set(["Fabric", "Subscription", "B2B Subscription", "Credits", "Sewing Equipment"])
  return all.filter((p) => !EXCLUDE.has(p.product_type))
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A 429 says "you are asking too fast", not "this url is dead" — treating it as
// a verdict would abort a perfectly good repair, or worse, look like evidence a
// live product is missing. Retry it with backoff, honouring Retry-After, and
// only report a status once the store actually commits to one. 5xx gets the
// same treatment since it is equally transient.
async function headOk(url, attempt = 0) {
  const MAX_ATTEMPTS = 4
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(20000),
    })

    const transient = res.status === 429 || res.status >= 500
    if (transient && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0
      const wait = retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt
      await sleep(wait)
      return headOk(url, attempt + 1)
    }

    return { status: res.status, type: res.headers.get("content-type") ?? "", attempts: attempt + 1 }
  } catch (error) {
    if (attempt < MAX_ATTEMPTS) {
      await sleep(2000 * 2 ** attempt)
      return headOk(url, attempt + 1)
    }
    return { status: 0, type: error.message, attempts: attempt + 1 }
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const products = await fetchProducts()

    // handle -> product, plus a craft-agnostic title index as the fallback tier.
    const byHandle = new Map()
    const byGarment = new Map()
    for (const product of products) {
      byHandle.set(product.handle, product)
      const gKey = normalize(
        baseTitle(product.title).replace(/\b(digital|paper|pattern)\b/gi, " "),
      )
      if (gKey.length < 3) continue
      if (!byGarment.has(gKey)) byGarment.set(gKey, [])
      byGarment.get(gKey).push(product)
    }
    console.log(`store: ${products.length} products (magazines included), ${byHandle.size} handles\n`)

    const rows = await prisma.pattern.findMany({
      where: { designer_id: DESIGNER_ID },
      select: { id: true, name: true, url: true, thumbnail_url: true },
      orderBy: { id: "asc" },
    })

    const stale = rows.filter(
      (r) => (r.url ?? "").includes(DEAD) || (r.thumbnail_url ?? "").includes(DEAD),
    )

    const pickVariant = (product, want) => {
      const variants = (product.variants ?? []).filter((v) => {
        const t = (v.title ?? "").trim()
        return t === "Digital" || t === "Paper"
      })
      if (variants.length === 0) return product.variants?.[0] ?? null
      if (want) {
        const exact = variants.filter((v) => (v.title ?? "").trim() === want)
        if (exact.length === 1) return exact[0]
        if (exact.length === 0) return null
      }
      return variants.length === 1 ? variants[0] : null
    }

    // Product variants already claimed by a HEALTHY row. The earlier import
    // added live rows for some designs that also still exist as stale
    // pre-migration rows, so a repair can resolve to a product another row
    // already owns. Those stale rows are duplicates, not broken links, and
    // repairing them would leave two rows on one product.
    const claimedBy = new Map()
    for (const row of rows) {
      const url = row.url ?? ""
      if (url.includes(DEAD)) continue
      const variant = (url.match(/variant=(\d+)/) ?? [])[1]
      if (variant) claimedBy.set(variant, row)
    }

    const planned = []
    const combos = []
    const refused = []
    const duplicates = []

    for (const row of stale) {
      if (COMBO.test(row.name)) {
        combos.push(row)
        continue
      }

      const want = declaredFormat(row.name)
      const slug = slugify(garmentName(row.name))
      let product = null
      let tier = null

      // Tier A: exact handle match, including renamed products.
      if (slug.length >= 3) {
        const candidates = [slug, ...HANDLE_SUFFIXES.map((s) => `${slug}-${s}`)]
        const hits = candidates.filter((h) => byHandle.has(h))
        if (hits.length === 1) {
          product = byHandle.get(hits[0])
          tier = "handle"
        } else if (hits.length > 1) {
          refused.push({ row, reason: `${hits.length} handles match slug "${slug}"` })
          continue
        }
      }

      // Tier B: craft-agnostic title match, scoped to the declared format.
      if (!product) {
        const hits = byGarment.get(normalize(garmentName(row.name))) ?? []
        if (hits.length === 1) {
          product = hits[0]
          tier = "title"
        } else if (hits.length > 1) {
          refused.push({ row, reason: `${hits.length} products share that garment title` })
          continue
        }
      }

      if (!product) {
        refused.push({ row, reason: `no store handle or title for "${slug}"` })
        continue
      }

      const variant = pickVariant(product, want)
      if (!variant) {
        refused.push({ row, reason: `no single ${want ?? "Digital/Paper"} variant on ${product.handle}` })
        continue
      }

      // This design already has a healthy row: the stale one is a duplicate.
      const owner = claimedBy.get(String(variant.id))
      if (owner && owner.id !== row.id) {
        duplicates.push({ row, owner, handle: product.handle })
        continue
      }

      const rawImage = product.images?.[0]?.src ?? null
      // Keep the url repair even when the only image is a site banner.
      const image = rawImage && !GENERIC_IMAGE.test(rawImage) ? rawImage : null
      const needsThumb = (row.thumbnail_url ?? "").includes(DEAD)
      if (needsThumb && !image) {
        console.log(
          `  note: [${row.id}] ${row.name} - url repairable, but ${product.handle} only offers ${rawImage ? "a generic banner" : "no image"}; thumbnail left as-is`,
        )
      }

      planned.push({
        id: row.id,
        name: row.name,
        tier,
        storeTitle: product.title,
        productType: product.product_type,
        urlFrom: row.url,
        urlTo: `${STORE}/products/${product.handle}?variant=${variant.id}`,
        thumbFrom: row.thumbnail_url,
        thumbTo: image,
        needsUrl: (row.url ?? "").includes(DEAD),
        needsThumb: needsThumb && Boolean(image),
        legacyId: ((row.url ?? "").match(/\/(\d+)-/) ?? [])[1] ?? null,
        imageId: ((image ?? "").match(/\/(\d+)[_.]/) ?? [])[1] ?? null,
      })
    }

    console.log(`designer ${DESIGNER_ID}: ${rows.length} rows, ${stale.length} still on the dead host`)
    console.log(`  repairable                   : ${planned.length}`)
    console.log(`    - via handle (incl renames): ${planned.filter((p) => p.tier === "handle").length}`)
    console.log(`    - via craft-agnostic title : ${planned.filter((p) => p.tier === "title").length}`)
    console.log(`  Mix & Match combos, skipped  : ${combos.length}`)
    console.log(`  stale duplicates, skipped    : ${duplicates.length}`)
    console.log(`  refused                      : ${refused.length}`)
    console.log(`\n  url writes       : ${planned.filter((p) => p.needsUrl).length}`)
    console.log(`  thumbnail writes : ${planned.filter((p) => p.needsThumb).length}`)

    // Independent confirmation: the legacy PrestaShop id in the old url should
    // reappear in the new image filename. Only meaningful when both exist.
    const checkable = planned.filter((p) => p.legacyId && p.imageId)
    const agree = checkable.filter((p) => p.legacyId === p.imageId)
    console.log(
      `\nlegacy-id cross-check: ${agree.length}/${checkable.length} agree (${planned.length - checkable.length} rows have no comparable id)`,
    )
    checkable
      .filter((p) => p.legacyId !== p.imageId)
      .forEach((p) => console.log(`  MISMATCH [${p.id}] ${p.name}: legacy ${p.legacyId} vs image ${p.imageId}`))

    console.log(`\n=== all ${planned.length} planned repairs ===`)
    planned.forEach((p) => {
      console.log(`  [${p.id}] ${p.name}   (${p.tier}, ${p.productType})`)
      console.log(`      store: ${p.storeTitle}`)
      if (p.needsUrl) console.log(`      url  : ${p.urlTo}`)
      if (p.needsThumb) console.log(`      thumb: ${p.thumbTo}`)
    })

    if (combos.length > 0) {
      console.log(`\n=== Mix & Match combos (${combos.length}, never matched) ===`)
      combos.forEach((r) => console.log(`  [${r.id}] ${r.name}`))
    }
    if (duplicates.length > 0) {
      console.log(
        `\n=== stale duplicates (${duplicates.length}, skipped - these are not broken links) ===`,
      )
      duplicates.forEach((d) => {
        console.log(`  [${d.row.id}] ${d.row.name}`)
        console.log(`        same product as live row [${d.owner.id}] ${d.owner.name}`)
        console.log(`        product: ${d.handle}`)
      })
      console.log(
        `  These need a delete-or-keep decision, not a url repair. Not touched.`,
      )
    }
    if (refused.length > 0) {
      console.log(`\n=== refused (${refused.length}) ===`)
      refused.forEach((r) => console.log(`  [${r.row.id}] ${r.row.name}\n        ${r.reason}`))
    }

    // A url must stay unique across the whole designer, not just this batch.
    const finalUrl = new Map()
    rows.forEach((r) => {
      const change = planned.find((p) => p.id === r.id && p.needsUrl)
      finalUrl.set(r.id, change ? change.urlTo : r.url)
    })
    const seen = new Map()
    const collisions = []
    for (const [id, url] of finalUrl) {
      if (!url) continue
      const key = url.split("?")[0] + "|" + (url.match(/variant=(\d+)/) ?? [])[1]
      if (seen.has(key)) collisions.push({ key, ids: [seen.get(key), id] })
      else seen.set(key, id)
    }
    console.log(`\nurl collisions across all ${rows.length} rows after write: ${collisions.length}`)
    collisions.slice(0, 10).forEach((c) => console.log(`  ${c.key} <- rows ${c.ids.join(" and ")}`))

    // Live-check every replacement, since this batch is small.
    const urls = [...new Set(planned.filter((p) => p.needsUrl).map((p) => p.urlTo))]
    const thumbs = [...new Set(planned.filter((p) => p.needsThumb).map((p) => p.thumbTo))]
    console.log(`\n=== live check: ${urls.length} urls + ${thumbs.length} images ===`)
  let bad = 0
  let throttled = 0
  for (const url of urls) {
    const res = await headOk(url)
    const ok = res.status === 200
    if (!ok) bad++
    if (res.status === 429) throttled++
    const retries = res.attempts > 1 ? ` (after ${res.attempts} attempts)` : ""
    console.log(`  ${ok ? "ok " : "BAD"} ${res.status}  ${url}${retries}`)
    // Space out requests so the check itself does not trigger the throttling
    // it is trying to measure.
    await sleep(400)
    }
    for (const image of thumbs) {
      const res = await headOk(image)
      const ok = res.status === 200 && res.type.startsWith("image/")
      if (!ok) bad++
      console.log(`  ${ok ? "ok " : "BAD"} ${res.status} ${res.type}  ${image}`)
    }

    if (!APPLY) {
      console.log(`\nDRY RUN - nothing written.`)
      console.log(
        `${planned.filter((p) => p.needsUrl).length} urls and ${planned.filter((p) => p.needsThumb).length} thumbnails would change across ${planned.length} rows.`,
      )
      console.log("Re-run with --apply to write.")
      return
    }
    if (collisions.length > 0) {
      console.log("\nABORTED: url collisions detected. No rows written.")
      process.exitCode = 1
      return
    }
  if (bad > 0) {
    console.log(`\nABORTED: ${bad} replacement target(s) did not resolve. No rows written.`)
    if (throttled > 0) {
      console.log(
        `  ${throttled} of those were HTTP 429 (rate limited) even after backoff, which is a\n` +
          `  property of how fast this ran, not evidence the product is gone. Wait and re-run.`,
      )
    }
    process.exitCode = 1
    return
  }

    let written = 0
    for (let i = 0; i < planned.length; i += BATCH) {
      const slice = planned.slice(i, i + BATCH)
      await prisma.$transaction(
        slice.map((p) =>
          prisma.pattern.update({
            where: { id: p.id },
            data: {
              ...(p.needsUrl ? { url: p.urlTo } : {}),
              ...(p.needsThumb ? { thumbnail_url: p.thumbTo } : {}),
            },
          }),
        ),
      )
      written += slice.length
      console.log(`  wrote ${written}/${planned.length}`)
    }
    console.log(`\nDone. ${written} rows repaired.`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
