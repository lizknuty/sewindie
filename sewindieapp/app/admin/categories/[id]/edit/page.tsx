import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import SimpleEntityForm from "../../../components/SimpleEntityForm"

export default async function EditCategoryPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const categoryId = Number.parseInt(params.id, 10)

  if (isNaN(categoryId)) {
    notFound()
  }

  const category = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
  })

  if (!category) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Category</h1>
      <SimpleEntityForm
        entity={category}
        entityType="Category"
        apiPath="/api/categories"
        returnPath="/admin/categories"
      />
    </div>
  )
}
