import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default prisma

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
} from '@prisma/client'