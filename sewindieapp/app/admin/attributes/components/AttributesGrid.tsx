import Link from "next/link"
import { Pencil, SlidersHorizontal } from "lucide-react"
import type { AdminAttribute } from "@/admin/attributes/types"

export default function AttributesGrid({ attributes }: { attributes: AdminAttribute[] }) {
  return (
    <div className="patterns-grid">
      {attributes.map((attribute) => (
        <div key={attribute.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <SlidersHorizontal size={18} />
            </div>
            <h3 className="pattern-card-title">{attribute.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{attribute._count?.PatternAttribute ?? 0} patterns</span>
              <Link
                href={`/admin/attributes/${attribute.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${attribute.name}`}
                title="Edit attribute"
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
