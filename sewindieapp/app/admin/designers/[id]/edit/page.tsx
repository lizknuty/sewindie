import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import DesignerForm from "../../components/DesignerForm"

export default async function EditDesignerPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number
  const designerId = Number.parseInt(params.id, 10)

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
