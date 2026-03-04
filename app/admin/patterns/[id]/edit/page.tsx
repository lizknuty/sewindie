import PatternForm from "@/app/admin/patterns/components/PatternForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditPatternPage({ params }: { params: { id: string } }) {
  const patternId = Number.parseInt(params.id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
    include: {
      designer: true,
      fabricType: true,
      audience: true,
      format: true,
      categories: true,
      suggestedFabrics: true,
    },
  })

  if (!pattern) {
    notFound()
  }

  const designers = await prisma.designer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const fabricTypes = await prisma.fabricType.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const audiences = await prisma.audience.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const formats = await prisma.format.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const suggestedFabrics = await prisma.suggestedFabric.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Pattern</h1>
      <PatternForm
        pattern={pattern}
        designers={designers}
        fabricTypes={fabricTypes}
        audiences={audiences}
        formats={formats}
        categories={categories}
        suggestedFabrics={suggestedFabrics}
      />
    </div>
  )
}
