import { PrismaClient } from '@prisma/client';

declare global {
  // Extend the globalThis type to include the prisma property
  namespace NodeJS {
    interface Global {
      prisma: PrismaClient | undefined;
    }
  }
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

export default prisma;


