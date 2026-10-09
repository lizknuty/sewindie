import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { patternsForPiratesAdapter as adapter } from "../app/lib/pattern-sync/adapters/patterns-for-pirates"

const EXECUTE = process.env.EXECUTE === "1"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL! }),
})

async function headStatus(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) })
    return String(res.status)
  } catch (e) {
    return "ERR " + (e as Error).message.slice(0, 40)
  }
}

async function main() {
  const designers = await prisma.designer.findMany({
    where: { url: { contains: "patternsforpirates", mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (designers.length !== 1) throw new Error("expected 1 P4P designer, got " + JSON.stringify(designers))
  const designerId = designers[0].id

  const scraped = await adapter.fetchCatalogue()
  const imageByKey = new Map<string, string>()
  for (const s of scraped) {
    const key = adapter.identityKey(s.url)
    if (key && s.imageUrl) imageByKey.set(key, s.imageUrl)
  }

  const rows = await prisma.pattern.findMany({
    where: { designer_id: designerId },
    select: { id: true, name: true, url: true, thumbnail_url: true },
  })

  const updates: { id: number; name: string; from: string | null; to: string }[] = []
  const alreadyShopify: number[] = []
  const noMatch: string[] = []
  for (const r of rows) {
    const key = adapter.identityKey(r.url)
    const next = key ? imageByKey.get(key) : undefined
    if (!next) { noMatch.push(`${r.id} ${r.name} (${r.url})`); continue }
    if (r.thumbnail_url && /cdn\.shopify\.com|\/cdn\/shop\//.test(r.thumbnail_url)) { alreadyShopify.push(r.id); continue }
    updates.push({ id: r.id, name: r.name, from: r.thumbnail_url, to: next })
  }

  const hosts = new Map<string, number>()
  for (const u of updates) {
    const h = u.from ? new URL(u.from).host : "(null)"
    hosts.set(h, (hosts.get(h) ?? 0) + 1)
  }

  console.log(`designer=${designerId} dbRows=${rows.length} scraped=${scraped.length} withImage=${imageByKey.size}`)
  console.log(`toUpdate=${updates.length} alreadyShopify=${alreadyShopify.length} noMatch=${noMatch.length}`)
  console.log("old thumbnail hosts:", Object.fromEntries(hosts))
  console.log("sample old-URL HEAD status:")
  for (const u of updates.filter((x) => x.from).slice(0, 5)) console.log("  ", await headStatus(u.from!), u.from)
  console.log("sample new-URL HEAD status:")
  for (const u of updates.slice(0, 3)) console.log("  ", await headStatus(u.to), u.to)
  for (const n of noMatch) console.log("NOMATCH", n)

  if (!EXECUTE) { console.log("DRY RUN, nothing written"); return }
  let done = 0
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50)
    await prisma.$transaction(batch.map((u) => prisma.pattern.update({ where: { id: u.id }, data: { thumbnail_url: u.to } })))
    done += batch.length
  }
  console.log(`EXECUTED updated=${done}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
