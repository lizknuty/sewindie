import { readFileSync } from "node:fs"
import { grasserAdapter, grasserSlug } from "../app/lib/pattern-sync/adapters/grasser"

type Detail = { url: string; slug: string | null; category: string | null; difficulty: number | null }

async function main() {
  const cache: Detail[] = JSON.parse(readFileSync("scripts/tmp-grasser-cache.json", "utf8"))
  const bySlug = new Map(cache.map((d) => [d.slug, d]))

  const catalogue = await grasserAdapter.fetchCatalogue()
  const patterns = catalogue.filter((p) => p.kind === "pattern")

  // Leading noun = text before the first comma, lowercased.
  const nounCounts = new Map<string, number>()
  // Audience cue in the name.
  const audCue = new Map<string, number>()
  const audRe: [string, RegExp][] = [
    ["kids: girl", /\bgirl'?s?\b/i],
    ["kids: boy", /\bboy'?s?\b/i],
    ["kids: child/kid", /\b(child|children|kid'?s?|baby|infant|teen)\b/i],
    ["men", /\b(men'?s?|male|man'?s?)\b/i],
    ["maternity", /\b(pregnan|maternity|nursing)\w*/i],
  ]

  for (const p of patterns) {
    const head = p.name.split(",")[0].trim().toLowerCase()
    nounCounts.set(head, (nounCounts.get(head) ?? 0) + 1)
    for (const [label, re] of audRe) {
      if (re.test(p.name)) audCue.set(label, (audCue.get(label) ?? 0) + 1)
    }
  }

  console.log(`patterns: ${patterns.length}`)
  console.log(`\n=== LEADING NOUN (before first comma), top 60 ===`)
  const sorted = [...nounCounts.entries()].sort((a, b) => b[1] - a[1])
  for (const [n, c] of sorted.slice(0, 60)) console.log(`  x${c}\t${n}`)
  console.log(`\n(distinct leading nouns: ${nounCounts.size})`)

  console.log(`\n=== AUDIENCE CUES in names ===`)
  for (const [l, c] of [...audCue.entries()].sort((a, b) => b[1] - a[1])) console.log(`  x${c}\t${l}`)

  // Cross-tab: for items whose itemprop is ALL PATTERNS / 50 Cents (no garment leaf),
  // what do their names look like? These are the ones name-based mapping must cover.
  const noLeaf = patterns.filter((p) => {
    const d = bySlug.get(grasserSlug(p.url))
    const cat = d?.category ?? ""
    return !cat || cat === "ALL PATTERNS" || cat === "Patterns for 50 Cents" || cat === "KID'S PATTERNS"
  })
  const noLeafNoun = new Map<string, number>()
  for (const p of noLeaf) {
    const head = p.name.split(",")[0].trim().toLowerCase()
    noLeafNoun.set(head, (noLeafNoun.get(head) ?? 0) + 1)
  }
  console.log(`\n=== NAMES of items with NO garment leaf in itemprop (${noLeaf.length}), top 40 ===`)
  for (const [n, c] of [...noLeafNoun.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  x${c}\t${n}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
