import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditFormatPage({ params }: { params: { id: string } }) {
  const formatId = Number.parseInt(params.id, 10)

  if (isNaN(formatId)) {
    notFound()
  }

  const format = await prisma.format.findUnique({
    where: { id: formatId },
  })

  if (!format) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Format</h1>
      <SimpleEntityForm entityType="formats" entityId={params.id} />
    </div>
  )
}
