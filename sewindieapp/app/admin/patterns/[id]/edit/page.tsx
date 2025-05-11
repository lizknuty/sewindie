import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import PatternForm from "../../components/PatternForm"

export default async function EditPatternPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const patternId = Number.parseInt(params.id, 10)

  if (isNaN(patternId)) {
    notFound()
  }

  const pattern = await prisma.pattern.findUnique({
    where: {
      id: patternId,
    },
    include: {
      designer: true,
      PatternCategory: {
        include: {
          category: true,
        },
      },
      PatternAudience: {
        include: {
          audience: true,
        },
      },
      PatternFabricType: {
        include: {
          fabricType: true,
        },
      },
      PatternSuggestedFabric: {
        include: {
          suggestedFabric: true,
        },
      },
      PatternAttribute: {
        include: {
          attribute: true,
        },
      },
      PatternFormat: {
        include: {
          Format: true,
        },
      },
    },
  })

  if (!pattern) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Pattern</h1>
      <PatternForm pattern={pattern} />
    </div>
  )
}
