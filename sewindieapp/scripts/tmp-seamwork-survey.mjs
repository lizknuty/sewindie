import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import fs from "node:fs"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const slugOf = (u) => {
  try {
    return new URL(u).pathname.split("/").filter(Boolean).pop() || ""
  } catch {
    return ""
  }
}

async function main() {
  const cards = []
  for (let page = 1; page <= 25; page++) {
    const res = await fetch(`https://www.seamwork.com/pdf-sewing-patterns?page=${page}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(40000),
    })
    if (!res.ok) break
    const html = await res.text()
    const items = html.split(/<li data-bookmarkable-type="Product"/).slice(1)
    if (!items.length) break
    for (const li of items) {
      const id = (li.match(/data-bookmarkable-id="(\d+)"/) || [])[1]
      const cls = (li.match(/class="product-preview ([^"]*)"/) || [])[1] || ""
      const href = (li.match(/href="(\/pdf-sewing-patterns\/[a-z0-9-]+)"/) || [])[1]
      const name = (li.match(/<h3>\s*<a[^>]*>([^<]*)<\/a>/) || [])[1]
      const img = (li.match(/<img[^>]*src="([^"]+)"/) || [])[1]
      const price = (li.match(/product--price">\s*<p>([^<]*)</) || [])[1]
      if (href) cards.push({ id, cls, href, name: name ? decode(name) : null, img, price: price ? decode(price) : null })
    }
  }

  const uniq = new Map()
  for (const c of cards) if (!uniq.has(c.href)) uniq.set(c.href, c)
  const list = [...uniq.values()]
  console.log(`cards scraped: ${cards.length} | unique: ${list.length}`)

  const byCls = {}
  for (const c of list) byCls[c.cls] = (byCls[c.cls] || 0) + 1
  console.log("\n=== css classes (product type signal) ===")
  Object.entries(byCls)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))

  console.log(`\nmissing name: ${list.filter((c) => !c.name).length} | missing img: ${list.filter((c) => !c.img).length}`)
  console.log(`bonus slugs: ${list.filter((c) => /-bonus$/.test(c.href)).length}`)
  console.log("\n=== sample ===")
  list.slice(0, 4).forEach((c) => console.log(`  [${c.id}] ${c.price} ${c.name}\n      ${c.href}\n      ${c.img}`))

  console.log("\n=== cards WITHOUT thumbnail-pattern class ===")
  list.filter((c) => !/thumbnail-pattern/.test(c.cls)).forEach((c) => console.log(`  [${c.cls}] ${c.name} -> ${c.href}`))

  fs.writeFileSync("/tmp/sw-cards.json", JSON.stringify(list))

  const db = await prisma.pattern.findMany({ where: { designer_id: 112 }, select: { id: true, name: true, url: true } })
  console.log(`\n\n=== DB comparison (${db.length} rows) ===`)

  const storeByName = new Map(list.map((c) => [norm(c.name), c]))
  console.log(`exact name match:  ${db.filter((r) => storeByName.has(norm(r.name))).length} / ${db.length}`)

  const storeSlugs = list.map((c) => ({ ...c, slug: c.href.split("/").pop() }))
  const bySlug = new Map(storeSlugs.map((c) => [c.slug, c]))
  console.log(`exact slug match:  ${db.filter((r) => bySlug.has(slugOf(r.url))).length} / ${db.length}`)

  let tokHit = 0
  let tokAmb = 0
  let tokNone = 0
  const ambiguous = []
  const none = []
  for (const r of db) {
    const tok = slugOf(r.url).split("-")[0]
    const hits = storeSlugs.filter((c) => c.slug.split("-")[0] === tok)
    if (hits.length === 1) tokHit++
    else if (hits.length > 1) {
      tokAmb++
      if (ambiguous.length < 10) ambiguous.push({ db: r.name, tok, hits: hits.map((h) => h.slug) })
    } else {
      tokNone++
      if (none.length < 15) none.push({ name: r.name, url: r.url })
    }
  }
  console.log(`\nfirst-token unique: ${tokHit} | ambiguous: ${tokAmb} | no match: ${tokNone}`)

  console.log("\n=== ambiguous examples ===")
  ambiguous.forEach((a) => console.log(`  ${a.db} (tok=${a.tok})\n     ${a.hits.join("\n     ")}`))

  console.log("\n=== DB rows with NO store match ===")
  none.forEach((n) => console.log(`  ${n.name}  <-  ${n.url}`))

  // db url path styles
  const styles = {}
  for (const r of db) {
    try {
      const seg = new URL(r.url).pathname.split("/").filter(Boolean)[0]
      styles[seg] = (styles[seg] || 0) + 1
    } catch {
      styles["(bad)"] = (styles["(bad)"] || 0) + 1
    }
  }
  console.log("\n=== db url path styles ===", JSON.stringify(styles))
}

main()
  .catch((e) => console.log("ERR", e.message))
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
