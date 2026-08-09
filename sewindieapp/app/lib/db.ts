import { prisma } from "@/lib/prisma"
import type {
  Attribute,
  Audience,
  Category,
  Designer,
  FabricType,
  Pattern,
  SuggestedFabric,
  PatternAttribute,
  PatternAudience,
  PatternCategory,
  PatternFabricType,
  PatternSuggestedFabric,
} from "@prisma/client"

// Reuse the single, adapter-configured Prisma client defined in lib/prisma.ts.
// Creating a second `new PrismaClient()` here would bypass the PrismaPg adapter
// and open a separate connection pool.
export default prisma

export type {
  Attribute,
  Audience,
  Category,
  Designer,
  FabricType,
  Pattern,
  SuggestedFabric,
  PatternAttribute,
  PatternAudience,
  PatternCategory,
  PatternFabricType,
  PatternSuggestedFabric,
}
