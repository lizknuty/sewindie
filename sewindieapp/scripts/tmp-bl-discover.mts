import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
const BASE = "https://booandlu.com/wp-json/wp/v2"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function get(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return { body: (await res.json()) as any[], headers: res.headers }
}

const cats = (await get(`${BASE}/product_cat?per_page=100`)).body
const byId = new Map(cats.map((c: any) => [c.id, c]))
const products: any[] = []
for (let page = 1; page <= 10; page++) {
  const { body, headers } = await get(`${BASE}/product?per_page=100&page=${page}`)
  products.push(...body)
  if (page >= Number(headers.get("x-wp-totalpages") ?? 1) || body.length === 0) break
  await sleep(1500)
}

const bundleId = cats.find((c: any) => c.slug === "bundles")?.id
const singles = products.filter(
  (p) => !(p.product_cat ?? []).includes(bundleId) && !/\bbundles?\b/i.test(p.title?.rendered ?? ""),
)
console.log("products", products.length, "singles", singles.length)

const leafCount = new Map<string, number>()
let noAudienceBranch = 0
let noGarment = 0
let skill = 0
const skillWords = new Map<string, number>()
const noGarmentNames: string[] = []
const ROOT_AUDIENCE = new Set(["childrens-sewing-patterns", "baby", "adult-sewing-patterns", "juniors"])
const NON_GARMENT_ROOTS = new Set(["bundles", "new", "backtoschool", "cozy", "fall-favs", "free", "bl-basics-adult", "bl-basics-children", "subscriber-exclusive", "5-feature", "featured", "patterns"])

for (const p of singles) {
  const terms = (p.product_cat ?? []).map((id: number) => byId.get(id)).filter(Boolean)
  const roots = new Set<string>()
  let garment = false
  for (const t of terms) {
    let r = t
    while (r.parent) r = byId.get(r.parent)
    roots.add(r.slug)
    const isLeafish = t.parent !== 0 && !["girl", "boy", "baby-girl", "baby-boy"].includes(t.slug)
    const isKnitWoven = /knit|woven/.test(t.slug)
    if ((isLeafish && !isKnitWoven) || t.slug === "accessories-sewing-patterns") {
      garment = true
      leafCount.set(`${t.slug} (${t.name})`, (leafCount.get(`${t.slug} (${t.name})`) ?? 0) + 1)
    }
  }
  if (![...roots].some((r) => ROOT_AUDIENCE.has(r) || r === "accessories-sewing-patterns")) noAudienceBranch++
  if (!garment) {
    noGarment++
    noGarmentNames.push(`${p.title?.rendered} [${terms.map((t: any) => t.slug).join(",")}]`)
  }
  const text = `${p.content?.rendered ?? ""} ${p.excerpt?.rendered ?? ""}`.replace(/<[^>]+>/g, " ")
  const m = text.match(/(skill level|difficulty|level)[^.]{0,60}/i)
  if (m) {
    skill++
    const w = text.match(/\b(confident beginner|advanced beginner|beginner|intermediate|advanced|easy)\b/i)?.[1]?.toLowerCase() ?? "?"
    skillWords.set(w, (skillWords.get(w) ?? 0) + 1)
  }
}
console.log("singles with no audience branch:", noAudienceBranch)
console.log("singles with no garment term:", noGarment)
for (const n of noGarmentNames.slice(0, 40)) console.log("  NOGARMENT", n)
console.log("garment terms:")
for (const [k, v] of [...leafCount].sort((a, b) => b[1] - a[1])) console.log(" ", v, k)
console.log("description mentions skill/difficulty:", skill, Object.fromEntries(skillWords))

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }) })
console.log("DB audiences:", (await prisma.audience.findMany({ select: { name: true } })).map((a) => a.name).join(" | "))
console.log("DB categories:", (await prisma.category.findMany({ select: { name: true } })).map((a) => a.name).join(" | "))
await prisma.$disconnect()
