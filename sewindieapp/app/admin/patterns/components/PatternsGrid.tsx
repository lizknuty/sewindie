import Link from "next/link"
import Image from "next/image"
import { Pencil } from "lucide-react"
import PatternStatusBadge from "./PatternStatusBadge"
import DifficultyIndicator from "./DifficultyIndicator"
import type { AdminPattern } from "../types"

export default function PatternsGrid({ patterns }: { patterns: AdminPattern[] }) {
  return (
    <div className="patterns-grid">
      {patterns.map((pattern) => (
        <div key={pattern.id} className="pattern-card">
          <div className="pattern-card-media">
            {pattern.thumbnail_url ? (
              <Image
                src={pattern.thumbnail_url || "/placeholder.svg"}
                alt={pattern.name}
                width={220}
                height={220}
              />
            ) : (
              <div className="pattern-card-media-empty" aria-hidden="true" />
            )}
            <div className="pattern-card-status">
              <PatternStatusBadge status={pattern.status} />
            </div>
          </div>
          <div className="pattern-card-body">
            <h3 className="pattern-card-title">{pattern.name}</h3>
            <p className="pattern-card-designer">{pattern.designer?.name ?? "-"}</p>
            <div className="category-chips">
              {pattern.PatternCategory?.slice(0, 2).map((pc) => (
                <span key={pc.category.id} className="category-chip">
                  {pc.category.name}
                </span>
              ))}
              {pattern.PatternCategory && pattern.PatternCategory.length > 2 && (
                <span className="category-chip category-chip-more">
                  +{pattern.PatternCategory.length - 2}
                </span>
              )}
            </div>
            <div className="pattern-card-footer">
              <DifficultyIndicator difficulty={pattern.difficulty} />
              <Link
                href={`/admin/patterns/${pattern.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${pattern.name}`}
                title="Edit pattern"
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
