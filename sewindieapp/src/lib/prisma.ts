import { PrismaClient } from '@prisma/client';

declare global {
  // Allow global `prisma` for hot-reloading in development to avoid multiple Prisma client instances
  var prisma: PrismaClient | undefined;
}

// Define the Prisma client with a specific type
const prisma: PrismaClient = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;

