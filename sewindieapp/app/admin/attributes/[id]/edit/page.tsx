import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditAttributePage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const attributeId = Number.parseInt(params.id, 10)

  if (isNaN(attributeId)) {
    notFound()
  }

  const attribute = await prisma.attribute.findUnique({
    where: {
      id: attributeId,
    },
  })

  if (!attribute) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Attribute</h1>
      <SimpleEntityForm
        entity={attribute}
        entityType="Attribute"
        apiPath="/api/attributes"
        returnPath="/admin/attributes"
      />
    </div>
  )
}
