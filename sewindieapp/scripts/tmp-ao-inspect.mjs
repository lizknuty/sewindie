// Inspect the Allie Olson Shopify catalogue. Read-only, no DB writes.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"

async function fetchAll(path) {
  const out = []
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`https://allieolson.com${path}?limit=250&page=${page}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
    })
    if (!res.ok) break
    const body = await res.json()
    const products = body?.products ?? []
    if (products.length === 0) break
    out.push(...products)
    if (products.length < 250) break
  }
  return out
}

async function main() {
  const collection = await fetchAll("/collections/digital-patterns/products.json")
  const store = await fetchAll("/products.json")

  console.log(`=== digital-patterns collection: ${collection.length} products ===\n`)
  for (const p of collection) {
    const variants = (p.variants ?? []).map((v) => v.title).join(" | ")
    const img = p.images?.[0]?.src ?? "(NO IMAGE)"
    console.log(`- ${p.title}`)
    console.log(`    handle       : ${p.handle}`)
    console.log(`    product_type : ${p.product_type || "(empty)"}`)
    console.log(`    published_at : ${p.published_at}`)
    console.log(`    tags         : ${(p.tags ?? []).join(", ") || "(none)"}`)
    console.log(`    variants(${(p.variants ?? []).length}) : ${variants}`)
    console.log(`    images(${(p.images ?? []).length})    : ${img}`)
  }

  const inCollection = new Set(collection.map((p) => p.id))
  const outside = store.filter((p) => !inCollection.has(p.id))
  console.log(`\n=== in store but NOT in digital-patterns: ${outside.length} ===`)
  for (const p in outside) {
    // placeholder, replaced below
  }
  for (const p of outside) {
    console.log(`- ${p.title}`)
    console.log(`    handle=${p.handle} type=${p.product_type || "(empty)"} tags=${(p.tags ?? []).join(", ") || "(none)"}`)
    console.log(`    variants: ${(p.variants ?? []).map((v) => v.title).join(" | ")}`)
  }

  // The body_html is the only place a description/skill level might live.
  console.log(`\n=== sample body_html (first product, first 700 chars) ===`)
  const sample = collection[0]
  if (sample) {
    const text = (sample.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    console.log(`  ${sample.title}:`)
    console.log(`  ${text.slice(0, 700)}`)
  }

  // Do any bodies mention a skill/difficulty level or fabric requirements?
  console.log(`\n=== signal scan across collection bodies ===`)
  const signals = { difficulty: 0, yardage: 0, projector: 0, a0: 0, letter: 0, a4: 0 }
  for (const p of collection) {
    const t = (p.body_html ?? "").toLowerCase()
    if (/beginner|intermediate|advanced|confident|skill level/.test(t)) signals.difficulty++
    if (/yard|yardage|metre|meter of fabric/.test(t)) signals.yardage++
    if (/projector/.test(t)) signals.projector++
    if (/a0|copy ?shop/.test(t)) signals.a0++
    if (/us letter|letter size/.test(t)) signals.letter++
    if (/\ba4\b/.test(t)) signals.a4++
  }
  console.log(`  ${JSON.stringify(signals)}  (of ${collection.length})`)
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
