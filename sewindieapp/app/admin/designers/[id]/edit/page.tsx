import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
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
    <div>
      <h1 className="mb-4">Edit Designer</h1>
      <DesignerForm designer={designer} />
    </div>
  )
}
