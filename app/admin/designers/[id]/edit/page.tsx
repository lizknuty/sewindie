import DesignerForm from "@/app/admin/designers/components/DesignerForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditDesignerPage({ params }: { params: { id: string } }) {
  const designerId = Number.parseInt(params.id, 10)

  if (isNaN(designerId)) {
    notFound()
  }

  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
  })

  if (!designer) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Designer</h1>
      <DesignerForm designerId={params.id} />
    </div>
  )
}
