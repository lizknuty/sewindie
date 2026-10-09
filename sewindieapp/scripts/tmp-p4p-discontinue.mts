import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL! }),
});

const IDS = [6169, 8731, 8732, 8733, 8734, 8735, 8736];

const designer = await prisma.designer.findFirst({
  where: { name: { contains: "Patterns for Pirates", mode: "insensitive" } },
  select: { id: true, name: true },
});
if (!designer) throw new Error("designer not found");

const rows = await prisma.pattern.findMany({
  where: { id: { in: IDS } },
  select: { id: true, name: true, status: true, designer_id: true },
});
const wrong = rows.filter((r) => r.designer_id !== designer.id);
if (rows.length !== IDS.length || wrong.length) {
  throw new Error(`safety check failed: found ${rows.length}, wrong designer ${wrong.length}`);
}

if (process.env.EXECUTE === "1") {
  const res = await prisma.pattern.updateMany({
    where: { id: { in: IDS }, designer_id: designer.id },
    data: { status: "DISCONTINUED" },
  });
  console.log(`EXECUTED updated=${res.count}`);
} else {
  console.log("DRY RUN");
}

const after = await prisma.pattern.findMany({
  where: { id: { in: IDS } },
  select: { id: true, name: true, status: true },
  orderBy: { id: "asc" },
});
for (const r of after) console.log(`ROW #${r.id} ${r.status} ${r.name}`);
await prisma.$disconnect();
