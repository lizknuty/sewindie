/**
 * Repairs rotted `thumbnail_url` values for one adapter-backed designer.
 *
 *   node --import ./scripts/ts-resolve-hook.mjs scripts/refresh-thumbnails.mts <adapter-slug>
 *   node --import ./scripts/ts-resolve-hook.mjs scripts/refresh-thumbnails.mts <adapter-slug> --apply
 *
 * Dry-run unless `--apply` is passed. Only ever writes `thumbnail_url`; names,
 * URLs, release dates and statuses are left alone, and no rows are created or
 * deleted.
 *
 * WHY THIS EXISTS. Stores rehost their product images. Peek-a-Boo re-uploaded
 * essentially its whole catalogue, which moved every image to a new id and left
 * 336 of 375 stored thumbnails returning 404:
 *
 *   was  /stencil/250x250/products/10191/37734/Adult_Anorak_Jacket_Cover-01__29206.1651722891.png
 *   now  /stencil/250x250/products/10191/54250/_37734__31060.1767086389.jpg
 *
 * The product id (10191) is stable; the image id is not. Note the new filename
 * embeds the *old* image id, which is what identifies this as a bulk rehost
 * rather than individually re-edited products. There is no URL transform that
 * recovers the new path from the old one, so the only reliable source is the
 * live catalogue -- which the sync adapters already know how to read.
 *
 * SAFETY. Every replacement is fetched and must return 200 with an `image/*`
 * content type before it is written. A row whose stored thumbnail still works
 * is left untouched even if the live listing now points somewhere else, so this
 * cannot churn working data.
 */
import pg from "pg"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeName, normalizeUrl } from "../app/lib/pattern-sync/compare.ts"
import { getAdapterBySlug, hostOf } from "../app/lib/pattern-sync/registry.ts"
import type { ScrapedPattern } from "../app/lib/pattern-sync/types.ts"

const USER_AGENT = "SewIndieBot/1.0 (+https://sewindie.app; pattern directory indexer)"
const REQUEST_TIMEOUT_MS = 20_000
const POLITE_DELAY_MS = 100

const slug = process.argv[2]
const apply = process.argv.includes("--apply")

if (!slug) {
  console.error("usage: refresh-thumbnails.mts <adapter-slug> [--apply]")
  process.exit(1)
}

const adapter = getAdapterBySlug(slug)
if (!adapter) {
  console.error(`no adapter with slug "${slug}"`)
  process.exit(1)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** True only for a live URL that actually serves an image. */
async function servesImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")
  } catch {
    return false
  }
}

/**
 * Last resort for a row the live listing doesn't carry: read `og:image` off the
 * product page itself. Bounded to unmatched rows, so this stays a handful of
 * requests rather than one per pattern.
 */
async function thumbnailFromProductPage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const og = (await res.text()).match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
    return og ? preferListingSizedVariant(og) : null
  } catch {
    return null
  }
}

/**
 * `og:image` is a full-size render, while the listing gives a 250x250 thumbnail.
 * On BigCommerce the two are the same asset under different path shapes, so
 * rewriting keeps every row's thumbnail a consistent size:
 *
 *   og       /s-m91f4azz/products/5551/images/52642/_48338__22366.1767081955.400.629.jpg
 *   stencil  /s-m91f4azz/images/stencil/250x250/products/5551/52642/_48338__22366.1767081955.jpg
 *
 * Returns the input untouched for any URL that isn't this shape, so non-
 * BigCommerce stores simply keep their `og:image`.
 */
function preferListingSizedVariant(url: string): string {
  const m = url.match(
    /^(https:\/\/cdn11\.bigcommerce\.com\/s-[^/]+)\/products\/(\d+)\/images\/(\d+)\/(.+?)\.\d+\.\d+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i,
  )
  if (!m) return url
  return `${m[1]}/images/stencil/250x250/products/${m[2]}/${m[3]}/${m[4]}.${m[5]}${m[6] ?? ""}`
}

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

console.log(`adapter: ${adapter.label} (${adapter.slug})`)
console.log(apply ? "mode   : APPLY (will write)\n" : "mode   : dry run (no writes)\n")

// Resolve the designer by store hostname, the same way the sync routes do, so
// this doesn't depend on hardcoded ids.
const designers = await prisma.designer.findMany({ select: { id: true, name: true, url: true } })
const designer = designers.find((d) => {
  const host = hostOf(d.url)
  return host && adapter.matchHosts.some((c) => c.replace(/^www\./, "") === host)
})

if (!designer) {
  console.error(`no designer in the database matches ${adapter.matchHosts.join(", ")}`)
  await prisma.$disconnect()
  await pool.end()
  process.exit(1)
}

console.log(`designer: [${designer.id}] ${designer.name}`)

const live: ScrapedPattern[] = await adapter.fetchCatalogue()
const rows = await prisma.pattern.findMany({
  where: { designer_id: designer.id },
  select: { id: true, name: true, url: true, thumbnail_url: true },
  orderBy: { id: "asc" },
})
console.log(`live listings: ${live.length}   stored rows: ${rows.length}\n`)

// Same matching order the sync uses: URL is identity, name is the fallback that
// survives a re-slug.
const liveByUrl = new Map<string, ScrapedPattern>()
for (const item of live) {
  const key = normalizeUrl(item.url)
  if (key) liveByUrl.set(key, item)
}
const liveByName = new Map<string, ScrapedPattern>()
for (const item of live) {
  const key = normalizeName(item.name)
  if (key && !liveByName.has(key)) liveByName.set(key, item)
}

type Candidate = { id: number; name: string; from: string | null; to: string; source: string }
const candidates: Candidate[] = []
const alreadyFine: number[] = []
const unresolved: { id: number; name: string; url: string; reason: string }[] = []

for (const row of rows) {
  const match = liveByUrl.get(normalizeUrl(row.url) ?? "") ?? liveByName.get(normalizeName(row.name))
  const proposed = match?.imageUrl ?? null

  if (proposed && proposed !== row.thumbnail_url) {
    candidates.push({ id: row.id, name: row.name, from: row.thumbnail_url, to: proposed, source: "listing" })
    continue
  }
  if (proposed) {
    alreadyFine.push(row.id)
    continue
  }

  // Not in the live listing. If the stored image still loads there is nothing to
  // fix; otherwise try the product page before giving up.
  if (row.thumbnail_url && (await servesImage(row.thumbnail_url))) {
    alreadyFine.push(row.id)
    continue
  }
  const fromPage = await thumbnailFromProductPage(row.url)
  if (fromPage) {
    candidates.push({ id: row.id, name: row.name, from: row.thumbnail_url, to: fromPage, source: "product page" })
  } else {
    unresolved.push({ id: row.id, name: row.name, url: row.url, reason: "not listed upstream and no usable page image" })
  }
  await sleep(POLITE_DELAY_MS)
}

console.log(`thumbnails already current : ${alreadyFine.length}`)
console.log(`replacement candidates     : ${candidates.length}`)
console.log(`unresolved                 : ${unresolved.length}\n`)

// Never write a URL without confirming it serves an image, and never replace a
// stored thumbnail that still works.
console.log(`verifying ${candidates.length} candidates (and the values they'd replace)...`)
const confirmed: Candidate[] = []
const rejected: { c: Candidate; why: string }[] = []
let checked = 0

for (const c of candidates) {
  if (!(await servesImage(c.to))) {
    rejected.push({ c, why: "replacement did not serve an image" })
  } else if (c.from && (await servesImage(c.from))) {
    rejected.push({ c, why: "stored thumbnail still works, left alone" })
  } else {
    confirmed.push(c)
  }
  if (++checked % 50 === 0) console.log(`  ...${checked}/${candidates.length}`)
  await sleep(POLITE_DELAY_MS)
}

console.log(`\nconfirmed broken and replaceable: ${confirmed.length}`)
console.log(`skipped                         : ${rejected.length}`)
for (const r of rejected.slice(0, 10)) console.log(`   [${r.c.id}] ${r.c.name} -- ${r.why}`)

console.log(`\n=== sample of what ${apply ? "was" : "would be"} written ===`)
for (const c of confirmed.slice(0, 5)) {
  console.log(`  [${c.id}] ${c.name}  (${c.source})`)
  console.log(`     from ${c.from}`)
  console.log(`     to   ${c.to}`)
}

if (unresolved.length) {
  console.log(`\n=== left with a broken thumbnail (needs a human) ===`)
  for (const u of unresolved) console.log(`  [${u.id}] ${u.name}\n        ${u.url}\n        ${u.reason}`)
}

if (!apply) {
  console.log(`\nDry run. Re-run with --apply to write ${confirmed.length} thumbnails.`)
} else {
  let written = 0
  for (const c of confirmed) {
    await prisma.pattern.update({ where: { id: c.id }, data: { thumbnail_url: c.to } })
    written++
    if (written % 50 === 0) console.log(`  ...wrote ${written}/${confirmed.length}`)
  }
  console.log(`\nwrote ${written} thumbnails.`)
}

await prisma.$disconnect()
await pool.end()
