import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminAudience } from "@/admin/audiences/types"

export default function AudiencesTable({ audiences }: { audiences: AdminAudience[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Audience</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {audiences.map((audience) => (
            <tr key={audience.id}>
              <td>
                <span className="pattern-name">{audience.name}</span>
              </td>
              <td className="text-end text-muted-cell">{audience._count?.PatternAudience ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/audiences/${audience.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${audience.name}`}
                    title="Edit audience"
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
