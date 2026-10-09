import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.POSTGRES_PRISMA_URL!;

// Without a connection timeout, pg waits forever for a free/new connection,
// which turns a DB hiccup into a request that never responds.
const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 10_000,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
