import Link from "next/link"
import { Pencil, Scissors } from "lucide-react"
import type { AdminSuggestedFabric } from "@/admin/suggested-fabrics/types"

export default function SuggestedFabricsGrid({ suggestedFabrics }: { suggestedFabrics: AdminSuggestedFabric[] }) {
  return (
    <div className="patterns-grid">
      {suggestedFabrics.map((fabric) => (
        <div key={fabric.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Scissors size={18} />
            </div>
            <h3 className="pattern-card-title">{fabric.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{fabric._count?.PatternSuggestedFabric ?? 0} patterns</span>
              <Link
                href={`/admin/suggested-fabrics/${fabric.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${fabric.name}`}
                title="Edit suggested fabric"
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
