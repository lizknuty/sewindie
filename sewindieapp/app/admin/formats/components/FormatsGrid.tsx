import Link from "next/link"
import { Pencil, FileText } from "lucide-react"
import type { AdminFormat } from "@/admin/formats/types"

export default function FormatsGrid({ formats }: { formats: AdminFormat[] }) {
  return (
    <div className="patterns-grid">
      {formats.map((format) => (
        <div key={format.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <FileText size={18} />
            </div>
            <h3 className="pattern-card-title">{format.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{format._count?.PatternFormat ?? 0} patterns</span>
              <Link
                href={`/admin/formats/${format.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${format.name}`}
                title="Edit format"
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
