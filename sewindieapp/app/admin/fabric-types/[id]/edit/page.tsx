import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditFabricTypePage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const fabricTypeId = Number.parseInt(params.id, 10)

  if (isNaN(fabricTypeId)) {
    notFound()
  }

  const fabricType = await prisma.fabricType.findUnique({
    where: {
      id: fabricTypeId,
    },
  })

  if (!fabricType) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Fabric Type</h1>
      <SimpleEntityForm
        entity={fabricType}
        entityType="Fabric Type"
        apiPath="/api/fabric-types"
        returnPath="/admin/fabric-types"
      />
    </div>
  )
}
