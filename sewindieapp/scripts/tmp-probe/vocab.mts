import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { loadVocab } from "../../app/lib/pattern-sync/metadata/writer"
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL }) })
const v: any = await loadVocab(prisma)
for (const [k, m] of Object.entries(v)) console.log(k, ":", [...(m as Map<string, unknown>).keys()].join(" | "))
const d = await prisma.pattern.groupBy({ by: ["difficulty"], _count: true })
console.log("difficulty:", d.map((x: any) => `${x.difficulty}=${x._count}`).join(" | "))
await prisma.$disconnect()
