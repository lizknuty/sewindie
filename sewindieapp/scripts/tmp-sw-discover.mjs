import { writeFileSync } from "node:fs"

const ORIGIN = "https://www.seamwork.com"
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const GARMENTS = ["tops", "bottoms", "dresses", "jumpsuits", "sweaters", "outerwear", "loungewear-activewear", "swimwear-lingerie", "gender-neutral", "accessories"]
const SKILLS = ["beginner", "advanced-beginner", "intermediate", "advanced"]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parse(html) {
  const out = []
  for (const chunk of html.split(/<li[^>]*data-bookmarkable-type="Product"/i).slice(1)) {
    const slug = chunk.match(/href="\/pdf-sewing-patterns\/([a-z0-9][a-z0-9-]*)"/i)?.[1]
    const name = (chunk.match(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim()
    if (slug) out.push({ slug, name })
  }
  return out
}

async function crawl(path) {
  const seen = new Map()
  for (let page = 1; page <= 40; page++) {
    const res = await fetch(`${ORIGIN}${path}?page=${page}`, { headers: { "User-Agent": UA } })
    if (!res.ok) throw new Error(`${path} p${page} -> ${res.status}`)
    const cards = parse(await res.text())
    let added = 0
    for (const c of cards) if (!seen.has(c.slug)) { seen.set(c.slug, c.name); added++ }
    if (cards.length === 0 || added === 0) break
    await sleep(600)
  }
  return seen
}

const all = await crawl("/pdf-sewing-patterns")
console.log("catalogue", all.size)
const membership = {}
for (const [slug, name] of all) membership[slug] = { name, garments: [], skills: [] }
for (const g of GARMENTS) {
  const s = await crawl(`/pdf-sewing-patterns/filters/${g}`)
  console.log("garment", g, s.size)
  for (const slug of s.keys()) (membership[slug] ??= { name: s.get(slug), garments: [], skills: [] }).garments.push(g)
}
for (const k of SKILLS) {
  const s = await crawl(`/pdf-sewing-patterns/filters/${k}`)
  console.log("skill", k, s.size)
  for (const slug of s.keys()) (membership[slug] ??= { name: s.get(slug), garments: [], skills: [] }).skills.push(k)
}
writeFileSync("/tmp/sw-membership.json", JSON.stringify(membership, null, 1))
const rows = Object.values(membership)
console.log("total", rows.length, "noGarment", rows.filter((r) => !r.garments.length).length, "noSkill", rows.filter((r) => !r.skills.length).length, "multiSkill", rows.filter((r) => r.skills.length > 1).length)
const combos = {}
for (const r of rows) { const k = r.garments.sort().join("+") || "(none)"; combos[k] = (combos[k] || 0) + 1 }
console.log(Object.entries(combos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}\t${k}`).join("\n"))
console.log("NO-GARMENT SAMPLES:", rows.filter((r) => !r.garments.length).map((r) => r.name).slice(0, 40).join(" | "))
