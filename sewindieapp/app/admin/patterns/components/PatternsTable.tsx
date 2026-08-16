import Link from "next/link"
import Image from "next/image"
import { Pencil } from "lucide-react"
import PatternStatusBadge from "./PatternStatusBadge"
import DifficultyIndicator from "./DifficultyIndicator"
import type { AdminPattern } from "../types"

export default function PatternsTable({ patterns }: { patterns: AdminPattern[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Designer</th>
            <th>Categories</th>
            <th>Difficulty</th>
            <th>Release Date</th>
            <th>Status</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((pattern) => (
            <tr key={pattern.id}>
              <td>
                <div className="pattern-cell">
                  <div className="pattern-thumb">
                    {pattern.thumbnail_url ? (
                      <Image
                        src={pattern.thumbnail_url || "/placeholder.svg"}
                        alt={pattern.name}
                        width={44}
                        height={44}
                      />
                    ) : (
                      <div className="pattern-thumb-empty" aria-hidden="true" />
                    )}
                  </div>
                  <span className="pattern-name">{pattern.name}</span>
                </div>
              </td>
              <td className="text-muted-cell">{pattern.designer?.name ?? "-"}</td>
              <td>
                <div className="category-chips">
                  {pattern.PatternCategory && pattern.PatternCategory.length > 0 ? (
                    pattern.PatternCategory.slice(0, 3).map((pc) => (
                      <span key={pc.category.id} className="category-chip">
                        {pc.category.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                  {pattern.PatternCategory && pattern.PatternCategory.length > 3 && (
                    <span className="category-chip category-chip-more">
                      +{pattern.PatternCategory.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <DifficultyIndicator difficulty={pattern.difficulty} />
              </td>
              <td className="text-muted-cell">
                {pattern.release_date
                  ? new Date(pattern.release_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "-"}
              </td>
              <td>
                <PatternStatusBadge status={pattern.status} />
              </td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/patterns/${pattern.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${pattern.name}`}
                    title="Edit pattern"
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
