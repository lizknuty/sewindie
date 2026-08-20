import Link from "next/link"
import { Pencil, Users } from "lucide-react"
import type { AdminAudience } from "@/admin/audiences/types"

export default function AudiencesGrid({ audiences }: { audiences: AdminAudience[] }) {
  return (
    <div className="patterns-grid">
      {audiences.map((audience) => (
        <div key={audience.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Users size={18} />
            </div>
            <h3 className="pattern-card-title">{audience.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{audience._count?.PatternAudience ?? 0} patterns</span>
              <Link
                href={`/admin/audiences/${audience.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${audience.name}`}
                title="Edit audience"
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
