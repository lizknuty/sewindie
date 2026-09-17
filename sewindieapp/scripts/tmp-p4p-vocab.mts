import { prisma } from "../app/lib/prisma"
import * as fs from "node:fs"

function strip(s: string | null | undefined): string {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#8243;|&#34;|&quot;/g, '"')
    .replace(/&#160;|&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

async function main() {
  const out: string[] = []
  const dump = (label: string, rows: { name: string }[]) => {
    out.push(`\n=== ${label} (${rows.length}) ===`)
    out.push(rows.map((r) => r.name).sort().join(" | "))
  }

  dump("AUDIENCE", await prisma.audience.findMany({ select: { name: true } }))
  dump("CATEGORY", await prisma.category.findMany({ select: { name: true } }))
  dump("FABRICTYPE", await prisma.fabricType.findMany({ select: { name: true } }))
  dump("ATTRIBUTE", await prisma.attribute.findMany({ select: { name: true } }))

  // P4P folksonomy: full category + tag frequency across the live catalogue.
  const all: any[] = []
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(
      `https://www.patternsforpirates.com/wp-json/wc/store/v1/products?per_page=100&page=${page}`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    )
    if (!res.ok) break
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < 100) break
  }
  out.push(`\n\n########## P4P LIVE PRODUCTS: ${all.length} ##########`)

  const catFreq = new Map<string, number>()
  const tagFreq = new Map<string, number>()
  for (const p of all) {
    for (const c of p.categories || []) catFreq.set(c.name, (catFreq.get(c.name) || 0) + 1)
    for (const t of p.tags || []) tagFreq.set(t.name, (tagFreq.get(t.name) || 0) + 1)
  }
  const fmt = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(" | ")
  out.push(`\n=== P4P CATEGORIES ===\n${fmt(catFreq)}`)
  out.push(`\n=== P4P TAGS ===\n${fmt(tagFreq)}`)

  // Fabric-suggestion + designed-for + sizes lines, real examples.
  out.push(`\n\n=== SAMPLE DESCRIPTION LINES ===`)
  let shown = 0
  for (const p of all) {
    const sd = strip(p.short_description)
    const fs1 = sd.match(/(specific )?fabric suggestions?:\s*([^.]*?)(?:\.|$|adult sizes|youth sizes|sizes included)/i)
    const df = sd.match(/(designed|drafted) for[^.]*/i)
    if ((fs1 || df) && shown < 10) {
      out.push(`\n[${p.name}]`)
      if (df) out.push(`  DESIGNED-FOR: ${df[0]}`)
      if (fs1) out.push(`  FABRIC-SUGG: ${fs1[2].trim()}`)
      shown++
    }
  }

  fs.writeFileSync("/tmp/p4p-vocab.txt", out.join("\n"))
  console.log(out.join("\n"))
  await prisma.$disconnect()
}
main()
