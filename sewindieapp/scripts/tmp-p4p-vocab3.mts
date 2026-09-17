import { prisma } from "../app/lib/prisma"

async function main() {
  const attrs = (await prisma.attribute.findMany({ select: { name: true } })).map((r) => r.name)
  // Show every attribute from "Sleeve" onward plus any length/waist/hood/closure terms.
  const interesting = attrs
    .filter((n) => /sleeve|length|waist|hood|zip|draw|cargo|split|crop|lined|elastic|raglan|dolman|shoulder|cuff|band|tie|wrap|split|side/i.test(n))
    .sort()
  console.log("=== ATTR candidates ===")
  console.log(interesting.join(" | "))
  await prisma.$disconnect()
}
main()
