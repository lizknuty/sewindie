// Verify the URLs/images we would write, and test whether published_at is a
// trustworthy release_date. Read-only.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function headOk(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) })
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const ra = Number(res.headers.get("retry-after")) || 0
      await sleep(ra > 0 ? ra * 1000 : 2000 * 2 ** attempt)
      return headOk(url, attempt + 1)
    }
    return res.status
  } catch (e) {
    if (attempt < 4) {
      await sleep(2000 * 2 ** attempt)
      return headOk(url, attempt + 1)
    }
    return 0
  }
}

async function main() {
  const res = await fetch("https://allieolson.com/collections/digital-patterns/products.json?limit=250", {
    headers: { "User-Agent": UA },
  })
  const products = (await res.json()).products ?? []

  console.log("=== is published_at a real release date? ===")
  const byStamp = new Map()
  for (const p of products) {
    const k = p.published_at
    if (!byStamp.has(k)) byStamp.set(k, [])
    byStamp.get(k).push(p.title)
  }
  for (const [stamp, titles] of byStamp) {
    const flag = titles.length > 1 ? "  <-- SHARED to the second, so this is a store migration timestamp" : ""
    console.log(`  ${stamp}  ${titles.join(", ")}${flag}`)
  }

  console.log("\n=== live check: product urls ===")
  let bad = 0
  for (const p of products) {
    const url = `https://www.allieolson.com/products/${p.handle}`
    const status = await headOk(url)
    if (status !== 200) bad++
    console.log(`  ${status === 200 ? "ok " : "BAD"} ${status}  ${url}`)
    await sleep(350)
  }

  console.log("\n=== live check: featured images ===")
  for (const p of products) {
    const img = p.images?.[0]?.src
    if (!img) {
      console.log(`  BAD (no image) ${p.title}`)
      bad++
      continue
    }
    const status = await headOk(img)
    if (status !== 200) bad++
    console.log(`  ${status === 200 ? "ok " : "BAD"} ${status}  ${p.title}`)
    await sleep(350)
  }

  console.log(`\n  total bad targets: ${bad}`)

  // Does the human-visible collection page show the same 11?
  console.log("\n=== collection page product count (what a visitor sees) ===")
  const html = await fetch("https://www.allieolson.com/collections/digital-patterns", {
    headers: { "User-Agent": UA },
  }).then((r) => r.text())
  const handles = new Set([...html.matchAll(/\/products\/([a-z0-9-]+)/g)].map((m) => m[1]))
  console.log(`  distinct product handles linked on page: ${handles.size}`)
  const apiHandles = new Set(products.map((p) => p.handle))
  const onlyPage = [...handles].filter((h) => !apiHandles.has(h))
  const onlyApi = [...apiHandles].filter((h) => !handles.has(h))
  console.log(`  on page but not in api : ${onlyPage.join(", ") || "(none)"}`)
  console.log(`  in api but not on page : ${onlyApi.join(", ") || "(none)"}`)
}

main().catch((e) => {
  console.error("FAILED:", e.message)
  process.exitCode = 1
})
