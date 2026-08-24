import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import PatternForm from "../../components/PatternForm"

export default async function EditPatternPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params before using it
  const resolvedParams = await params

  // Convert the string ID to a number for Prisma
  const patternId = Number.parseInt(resolvedParams.id, 10)

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
      PatternSizeChart: {
        include: {
          SizeChart: true,
        },
      },
    },
  })

  if (!pattern) {
    notFound()
  }

  return (
    <div className="admin-form-page">
      <header className="admin-form-header">
        <Link href="/admin/patterns" className="admin-form-back">
          <ArrowLeft size={15} />
          Back to Patterns
        </Link>
        <h1 className="admin-form-title">Edit Pattern</h1>
        <p className="admin-form-subtitle">{pattern.name}</p>
      </header>
      <PatternForm pattern={pattern} />
    </div>
  )
}
