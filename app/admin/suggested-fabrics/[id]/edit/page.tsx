import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditSuggestedFabricPage({ params }: { params: { id: string } }) {
  const suggestedFabricId = Number.parseInt(params.id, 10)

  if (isNaN(suggestedFabricId)) {
    notFound()
  }

  const suggestedFabric = await prisma.suggestedFabric.findUnique({
    where: { id: suggestedFabricId },
  })

  if (!suggestedFabric) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Suggested Fabric</h1>
      <SimpleEntityForm entityType="suggested-fabrics" entityId={params.id} />
    </div>
  )
}
