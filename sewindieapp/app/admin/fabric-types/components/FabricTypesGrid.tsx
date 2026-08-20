import Link from "next/link"
import { Pencil, Layers } from "lucide-react"
import type { AdminFabricType } from "@/admin/fabric-types/types"

export default function FabricTypesGrid({ fabricTypes }: { fabricTypes: AdminFabricType[] }) {
  return (
    <div className="patterns-grid">
      {fabricTypes.map((fabricType) => (
        <div key={fabricType.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Layers size={18} />
            </div>
            <h3 className="pattern-card-title">{fabricType.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{fabricType._count?.PatternFabricType ?? 0} patterns</span>
              <Link
                href={`/admin/fabric-types/${fabricType.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${fabricType.name}`}
                title="Edit fabric type"
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
