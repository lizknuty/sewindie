import { writeFileSync } from "node:fs"
import { grasserAdapter, grasserSlug } from "../app/lib/pattern-sync/adapters/grasser"

const ORIGIN = "https://en-grasser.com"
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const CACHE = "scripts/tmp-grasser-cache.json"
const CONCURRENCY = 10
const TIMEOUT_MS = 25_000

type Detail = {
  url: string
  slug: string | null
  category: string | null
  difficulty: number | null
  materials: string | null
}

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return await res.text()
}

function extract(html: string, url: string): Detail {
  const category = html.match(/itemprop="category"\s+content="([^"]+)"/i)?.[1]?.trim() ?? null
  const difMatch = html.match(/Difficulty:\s*([0-5])\s*\/\s*5/i)
  const difficulty = difMatch ? Number(difMatch[1]) : null
  // Grab a short slice of the "MATERIALS FOR SEWING" heading's following text for feasibility judgement only.
  let materials: string | null = null
  const mi = html.search(/MATERIALS FOR SEWING/i)
  if (mi >= 0) {
    const slice = html
      .slice(mi, mi + 1200)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    materials = slice.slice(0, 300)
  }
  return { url, slug: grasserSlug(url), category, difficulty, materials }
}

async function main() {
  console.log("Fetching catalogue (listing crawl)...")
  const catalogue = await grasserAdapter.fetchCatalogue()
  const patterns = catalogue.filter((p) => p.kind === "pattern")
  console.log(`catalogue: ${catalogue.length} total, ${patterns.length} patterns`)

  const results: Detail[] = []
  const queue = [...patterns.map((p) => p.url)]
  let done = 0
  let failed = 0

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const url = queue.shift()
        if (url === undefined) return
        try {
          const html = await getHtml(url)
          results.push(extract(html, url))
        } catch {
          failed++
          results.push({ url, slug: grasserSlug(url), category: null, difficulty: null, materials: null })
        }
        done++
        if (done % 100 === 0) console.log(`  ...${done}/${patterns.length}`)
      }
    }),
  )

  writeFileSync(CACHE, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} details to ${CACHE} (${failed} fetch failures)`)

  const withCat = results.filter((r) => r.category).length
  const withDif = results.filter((r) => r.difficulty != null).length
  const withMat = results.filter((r) => r.materials).length
  console.log(`\nCoverage: category ${withCat}, difficulty ${withDif}, materials ${withMat}`)

  // --- Category vocabulary (full itemprop path) ---
  const catCounts = new Map<string, number>()
  for (const r of results) {
    if (!r.category) continue
    catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1)
  }
  console.log(`\n=== DISTINCT itemprop=category (${catCounts.size}) ===`)
  for (const [c, n] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  x${n}  ${c}`)
  }

  // --- Audience prefix (first segment) ---
  const audCounts = new Map<string, number>()
  for (const r of results) {
    if (!r.category) continue
    const head = r.category.split("/")[0].trim()
    audCounts.set(head, (audCounts.get(head) ?? 0) + 1)
  }
  console.log(`\n=== AUDIENCE PREFIX (first segment) ===`)
  for (const [c, n] of [...audCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  x${n}  ${c}`)
  }

  // --- Leaf garment (last segment) ---
  const leafCounts = new Map<string, number>()
  for (const r of results) {
    if (!r.category) continue
    const segs = r.category.split("/").map((s) => s.trim())
    const leaf = segs[segs.length - 1]
    leafCounts.set(leaf, (leafCounts.get(leaf) ?? 0) + 1)
  }
  console.log(`\n=== LEAF GARMENT (last segment, ${leafCounts.size}) ===`)
  for (const [c, n] of [...leafCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  x${n}  ${c}`)
  }

  // --- Difficulty distribution ---
  const difCounts = new Map<number, number>()
  for (const r of results) {
    if (r.difficulty == null) continue
    difCounts.set(r.difficulty, (difCounts.get(r.difficulty) ?? 0) + 1)
  }
  console.log(`\n=== DIFFICULTY (N/5) ===`)
  for (const [d, n] of [...difCounts.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${d}/5  x${n}`)
  }

  console.log(`\n=== MATERIALS sample (first 3) ===`)
  for (const r of results.filter((x) => x.materials).slice(0, 3)) {
    console.log(`  ${r.slug}: ${r.materials}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
