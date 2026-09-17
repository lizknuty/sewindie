import { prisma } from "../app/lib/prisma"

async function main() {
  const attrs = await prisma.attribute.findMany({ select: { name: true } })
  const sf = await prisma.suggestedFabric.findMany({ select: { name: true } })
  console.log(`=== ATTRIBUTE (${attrs.length}) ===`)
  console.log(attrs.map((r) => r.name).sort().join(" | "))
  console.log(`\n=== SUGGESTEDFABRIC (${sf.length}) ===`)
  console.log(sf.map((r) => r.name).sort().join(" | "))
  await prisma.$disconnect()
}
main()
