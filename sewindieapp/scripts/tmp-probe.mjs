import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
const p = new PrismaClient({ adapter: new PrismaPg(pool) })
const ds = await p.designer.findMany({
  where: { status: "PUBLISHED" },
  select: { id: true, name: true, logo_url: true, address: true, facebook: true, instagram: true, pinterest: true, _count: { select: { patterns: true } } },
  orderBy: { patterns: { _count: "desc" } },
  take: 4,
})
for (const d of ds) console.log(d.id, "|", d.name, "| patterns:", d._count.patterns, "| logo:", !!d.logo_url, "| addr:", JSON.stringify(d.address), "| fb:", !!d.facebook, "ig:", !!d.instagram, "pin:", !!d.pinterest)
const u = await p.user.findFirst({ select: { id: true, email: true, name: true } })
console.log("user:", JSON.stringify(u))
console.log("collections:", await p.collection.count(), "| memberships:", await p.collectionPattern.count())
await p.$disconnect()
await pool.end()
