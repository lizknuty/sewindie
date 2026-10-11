import { readFileSync, writeFileSync } from "node:fs"

const STORE = "https://www.peekaboopatternshop.com"
const UA = "SewIndieBot/1.0 (+https://sewindie.app; pattern directory indexer)"
const OUT = "/tmp/pb-cats.json"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function productUrls(html) {
  const out = new Set()
  for (const m of html.matchAll(/class="card-title"[^>]*>\s*<a[^>]+href="([^"]+)"/g)) {
    try { out.add(new URL(m[1], STORE).pathname.replace(/\/+$/, "")) } catch {}
  }
  return out
}

function pageTitle(html) {
  return (html.match(/<h1[^>]*class="page-heading"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? html.match(/<title>([^<]+)/)?.[1] ?? "")
    .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
}

async function crawl(slug) {
  const members = new Set()
  let title = ""
  for (let p = 1; p <= 8; p++) {
    const html = await get(`${STORE}/${slug}/?limit=100&page=${p}`)
    if (p === 1) title = pageTitle(html)
    const urls = productUrls(html)
    const before = members.size
    urls.forEach((u) => members.add(u))
    if (urls.size < 100 || members.size === before) break
    await sleep(1200)
  }
  return { title, count: members.size, members: [...members] }
}

let state = { cats: {} }
try { state = JSON.parse(readFileSync(OUT, "utf8")) } catch {}

const SLUGS = [
  "sewing-patterns",
  "shop-by-skill-level", "sewing-patterns-for-beginners", "intermediate-sewing-patterns",
  "patterns-by-fabric-type", "knit-sewing-patterns", "woven-sewing-patterns",
  "sewing-patterns-for-women", "sewing-patterns-for-men", "sewing-patterns-for-girls", "boys-sewing-patterns",
  "baby-sewing-patterns", "newborn-sewing-patterns", "preemie-sewing-patterns", "maternity-sewing-patterns",
  "nursing-friendly-sewing-patterns", "plus-size-sewing-patterns",
  "clothing-patterns", "dress-patterns", "dress-patterns-for-women", "girls-dress-patterns",
  "skirt-patterns", "pants-patterns", "pants-and-skirts", "shorts-patterns", "girls-pants-pattern",
  "shirt-patterns", "sewing-patterns-for-womens-tops", "boys-shirt-hoodies-pullover-sewing-pattern",
  "hoodie-patterns", "jacket-patterns", "outerwear", "girls-jacket-pullover-and-hoodie-paterns", "boys-jacket-pullover-and-hoodie",
  "pajama-patterns", "womens-pajama-patterns", "girls-pajama-patterns", "boys-pajama-patterns",
  "swimsuit-patterns", "womens-swimsuit-patterns", "girls-swimsuit-pattern", "boys-swimsuit-patterns",
  "underwear-patterns", "womens-underwear-pattern", "boys-underwear-pattern",
  "leotard-patterns", "girls-romper-pattern", "boys-romper-sewing-pattern",
  "hat-patterns", "girls-hat-pattern", "shoe-patterns", "girls-shoes-sock-patterns", "boys-shoe-patterns",
  "new-category-2", "new-category-3", "new-category-14", "free-sewing-patterns",
]

for (const slug of SLUGS) {
  if (state.cats[slug]?.count != null) continue
  try {
    state.cats[slug] = await crawl(slug)
    console.log(String(state.cats[slug].count).padStart(4), slug, "|", state.cats[slug].title)
  } catch (e) {
    state.cats[slug] = { error: String(e) }
    console.log(" ERR", slug, String(e))
  }
  writeFileSync(OUT, JSON.stringify(state))
  await sleep(1200)
}
console.log("DONE")
