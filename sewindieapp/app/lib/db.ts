import { PrismaClient } from '@prisma/client'
import type { 
  Attribute,
  Category,
  Designer,
  Format,
  Pattern,
  SuggestedFabric,
  PatternAttribute,
  PatternCategory,
  PatternFormat,
  PatternSuggestedFabric
} from '.prisma/client'

// Create a new PrismaClient instance
const prisma = new PrismaClient()

// Export the prisma instance as default
export default prisma

// Export the types
export type {
  Attribute,
  Category,
  Designer,
  Format,
  Pattern,
  SuggestedFabric,
  PatternAttribute,
  PatternCategory,
  PatternFormat,
  PatternSuggestedFabric
}