const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
async function txt(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(18000), redirect: "follow" })
  return { status: r.status, body: await r.text() }
}
function cleanName(h1) {
  return h1
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+\s+/, "")
    .replace(/\s+(?:a\s+)?pdf sewing pattern\b.*$/i, "")
    .trim()
}

const sm = await txt("https://angelakane.com/sitemap.xml")
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const patternUrls = locs.filter((l) => /\/patterns\/.*\.php$/i.test(l))
console.log("pattern URLs:", patternUrls.length)

let okName = 0
let okImg = 0
for (const url of patternUrls) {
  const num = (url.match(/-(\d+)\.php$/) || [])[1] || ""
  const { status, body } = await txt(url)
  const h1raw = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || ""
  const name = cleanName(h1raw)
  // image whose folder matches this page's pattern number
  const imgs = [...body.matchAll(/(?:\.\.\/)*global_assets\/pattern_pics\/([^"'\s)]+\.(?:jpg|jpeg|png|webp))/gi)].map(
    (m) => m[1],
  )
  const ownImg = imgs.find((p) => new RegExp(`^${num}-`).test(p)) || null
  if (name) okName++
  if (ownImg) okImg++
  const price = (body.match(/£\s?\d+(?:\.\d{2})?/) || [])[0] || ""
  console.log(`  [${status}] #${num} name="${name}" img=${ownImg ? "Y" : "N"} price=${price}`)
}
console.log(`\nname ok: ${okName}/${patternUrls.length} | own-folder img ok: ${okImg}/${patternUrls.length}`)
