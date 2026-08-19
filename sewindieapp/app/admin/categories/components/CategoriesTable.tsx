import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminCategory } from "@/admin/categories/types"

export default function CategoriesTable({ categories }: { categories: AdminCategory[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td>
                <span className="pattern-name">{category.name}</span>
              </td>
              <td className="text-end text-muted-cell">{category._count?.PatternCategory ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/categories/${category.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${category.name}`}
                    title="Edit category"
                  >
                    <Pencil size={16} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
