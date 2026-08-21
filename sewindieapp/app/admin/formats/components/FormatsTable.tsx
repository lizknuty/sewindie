import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminFormat } from "@/admin/formats/types"

export default function FormatsTable({ formats }: { formats: AdminFormat[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Format</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((format) => (
            <tr key={format.id}>
              <td>
                <span className="pattern-name">{format.name}</span>
              </td>
              <td className="text-end text-muted-cell">{format._count?.PatternFormat ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/formats/${format.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${format.name}`}
                    title="Edit format"
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
