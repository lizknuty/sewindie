import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditAttributePage({ params }: { params: { id: string } }) {
  const attributeId = Number.parseInt(params.id, 10)

  if (isNaN(attributeId)) {
    notFound()
  }

  const attribute = await prisma.attribute.findUnique({
    where: { id: attributeId },
  })

  if (!attribute) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Attribute</h1>
      <SimpleEntityForm entityType="attributes" entityId={params.id} />
    </div>
  )
}
