import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditAudiencePage({ params }: { params: { id: string } }) {
  const audienceId = Number.parseInt(params.id, 10)

  if (isNaN(audienceId)) {
    notFound()
  }

  const audience = await prisma.audience.findUnique({
    where: { id: audienceId },
  })

  if (!audience) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Audience</h1>
      <SimpleEntityForm entityType="audiences" entityId={params.id} />
    </div>
  )
}
