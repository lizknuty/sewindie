import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import DesignerForm from "../../components/DesignerForm"

export default async function EditDesignerPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params before using it
  const resolvedParams = await params

  // Convert the string ID to a number
  const designerId = Number.parseInt(resolvedParams.id, 10)

  if (isNaN(designerId)) {
    notFound()
  }

  const designer = await prisma.designer.findUnique({
    where: {
      id: designerId,
    },
  })

  if (!designer) {
    notFound()
  }

  return (
    <div className="admin-form-page">
      <header className="admin-form-header">
        <Link href="/admin/designers" className="admin-form-back">
          <ArrowLeft size={15} />
          Back to Designers
        </Link>
        <h1 className="admin-form-title">Edit Designer</h1>
        <p className="admin-form-subtitle">{designer.name}</p>
      </header>
      <DesignerForm designer={designer} />
    </div>
  )
}
