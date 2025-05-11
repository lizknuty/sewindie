import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditSuggestedFabricPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const suggestedFabricId = Number.parseInt(params.id, 10)

  if (isNaN(suggestedFabricId)) {
    notFound()
  }

  const suggestedFabric = await prisma.suggestedFabric.findUnique({
    where: {
      id: suggestedFabricId,
    },
  })

  if (!suggestedFabric) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Suggested Fabric</h1>
      <SimpleEntityForm
        entity={suggestedFabric}
        entityType="Suggested Fabric"
        apiPath="/api/suggested-fabrics"
        returnPath="/admin/suggested-fabrics"
      />
    </div>
  )
}
