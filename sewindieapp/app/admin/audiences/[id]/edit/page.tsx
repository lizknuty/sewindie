import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditAudiencePage({ params }: { params: Promise<{ id: string }> }) {
  // Await params before using it
  const resolvedParams = await params

  // Convert the string ID to a number for Prisma
  const audienceId = Number.parseInt(resolvedParams.id, 10)

  if (isNaN(audienceId)) {
    notFound()
  }

  const audience = await prisma.audience.findUnique({
    where: {
      id: audienceId,
    },
  })

  if (!audience) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Audience</h1>
      <SimpleEntityForm
        entity={audience}
        entityType="Audience"
        apiPath="/api/audiences"
        returnPath="/admin/audiences"
      />
    </div>
  )
}
