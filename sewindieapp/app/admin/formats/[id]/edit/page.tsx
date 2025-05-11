import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditFormatPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const formatId = Number.parseInt(params.id, 10)

  if (isNaN(formatId)) {
    notFound()
  }

  const format = await prisma.format.findUnique({
    where: {
      id: formatId,
    },
  })

  if (!format) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Format</h1>
      <SimpleEntityForm entity={format} entityType="Format" apiPath="/api/formats" returnPath="/admin/formats" />
    </div>
  )
}
