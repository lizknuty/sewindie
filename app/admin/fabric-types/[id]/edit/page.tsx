import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditFabricTypePage({ params }: { params: { id: string } }) {
  const fabricTypeId = Number.parseInt(params.id, 10)

  if (isNaN(fabricTypeId)) {
    notFound()
  }

  const fabricType = await prisma.fabricType.findUnique({
    where: { id: fabricTypeId },
  })

  if (!fabricType) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Fabric Type</h1>
      <SimpleEntityForm entityType="fabric-types" entityId={params.id} />
    </div>
  )
}
