import { PrismaClient } from '@prisma/client'
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
  PatternSuggestedFabric
} from '@prisma/client'

// Declare the global type for PrismaClient
declare global {
  var prisma: PrismaClient | undefined
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

let prisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient()
  }
  prisma = global.prisma
}

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
  PatternSuggestedFabric
}