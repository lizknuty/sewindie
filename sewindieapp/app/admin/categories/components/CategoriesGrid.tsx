import Link from "next/link"
import { Pencil, Tag } from "lucide-react"
import type { AdminCategory } from "@/admin/categories/types"

export default function CategoriesGrid({ categories }: { categories: AdminCategory[] }) {
  return (
    <div className="patterns-grid">
      {categories.map((category) => (
        <div key={category.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Tag size={18} />
            </div>
            <h3 className="pattern-card-title">{category.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{category._count?.PatternCategory ?? 0} patterns</span>
              <Link
                href={`/admin/categories/${category.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${category.name}`}
                title="Edit category"
              >
                <Pencil size={16} />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
