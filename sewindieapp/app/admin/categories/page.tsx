import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      PatternCategory: true,
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Categories</h1>
        <Link href="/admin/categories/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Category
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Patterns</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.name}</td>
                <td>{category.PatternCategory?.length || 0}</td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/categories/${category.id}/edit`} className="btn btn-sm btn-outline-secondary">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
