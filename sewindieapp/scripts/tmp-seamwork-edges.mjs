import fs from "node:fs"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const list = JSON.parse(fs.readFileSync("/tmp/sw-cards.json", "utf8"))

const slugBonus = list.filter((c) => /-bonus$/.test(c.href))
const nameBonus = list.filter((c) => /\bbonus$/i.test(c.name))
console.log(`slug ends -bonus: ${slugBonus.length} | name ends Bonus: ${nameBonus.length}`)

const slugOnly = slugBonus.filter((c) => !/\bbonus$/i.test(c.name))
const nameOnly = nameBonus.filter((c) => !/-bonus$/.test(c.href))
console.log(`\nslug-bonus but name lacks Bonus: ${slugOnly.length}`)
slugOnly.forEach((c) => console.log(`  ${JSON.stringify(c.name)} -> ${c.href}`))
console.log(`name-Bonus but slug lacks -bonus: ${nameOnly.length}`)
nameOnly.forEach((c) => console.log(`  ${JSON.stringify(c.name)} -> ${c.href}`))

console.log("\n=== price vs bonus correlation ===")
const freeMembers = list.filter((c) => /free for seamwork members/i.test(c.price || ""))
console.log(`"Free for Seamwork Members": ${freeMembers.length}`)
console.log(`  of those that are bonus: ${freeMembers.filter((c) => /-bonus$/.test(c.href)).length}`)
console.log(`  NON-bonus free-for-members:`)
freeMembers.filter((c) => !/-bonus$/.test(c.href)).forEach((c) => console.log(`    ${c.name} -> ${c.href}`))

console.log('\n=== the 4 "Free!" items ===')
list.filter((c) => /^free!?$/i.test((c.price || "").trim())).forEach((c) => console.log(`  ${c.name} -> ${c.href}`))

console.log('\n=== the 10 "$15" items ===')
list.filter((c) => (c.price || "").trim() === "$15").forEach((c) => console.log(`  ${c.name} -> ${c.href}`))

console.log("\n=== anything that looks non-pattern (membership/class/kit/book/magazine/gift) ===")
list
  .filter((c) => /membership|subscription|magazine|\bclass\b|\bbook\b|gift card|workshop|bundle/i.test(c.name))
  .forEach((c) => console.log(`  ${c.name} -> ${c.href}`))

console.log("\n=== image url shapes ===")
const shapes = {}
for (const c of list) {
  const m = (c.img || "").match(/^\/media\/products\/[^/]+\//) ? "/media/products/<id>/" : c.img
  shapes[m] = (shapes[m] || 0) + 1
}
Object.entries(shapes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))

console.log("\n=== verifying a few bonus + new product pages resolve ===")
const probe = [
  ...list.filter((c) => /-bonus$/.test(c.href)).slice(0, 2),
  ...list.filter((c) => !/-bonus$/.test(c.href)).slice(0, 2),
]
for (const c of probe) {
  const url = `https://www.seamwork.com${c.href}`
  const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" })
  const html = await r.text()
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || ""
  console.log(`  ${r.status}  ${c.name}`)
  console.log(`        title: ${title.trim().slice(0, 70)}`)
  console.log(`        img:   https://www.seamwork.com${c.img}`)
}

console.log("\n=== do the card images actually load? ===")
for (const c of list.slice(0, 4)) {
  const u = `https://www.seamwork.com${c.img}`
  const r = await fetch(u, { headers: { "User-Agent": UA }, method: "GET" })
  console.log(`  ${r.status}  ${r.headers.get("content-type")}  ${c.img}`)
}
