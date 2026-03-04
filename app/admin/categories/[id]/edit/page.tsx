import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditCategoryPage({ params }: { params: { id: string } }) {
  const categoryId = Number.parseInt(params.id, 10)

  if (isNaN(categoryId)) {
    notFound()
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  })

  if (!category) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Category</h1>
      <SimpleEntityForm entityType="categories" entityId={params.id} />
    </div>
  )
}
