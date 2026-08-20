import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminAttribute } from "@/admin/attributes/types"

export default function AttributesTable({ attributes }: { attributes: AdminAttribute[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {attributes.map((attribute) => (
            <tr key={attribute.id}>
              <td>
                <span className="pattern-name">{attribute.name}</span>
              </td>
              <td className="text-end text-muted-cell">{attribute._count?.PatternAttribute ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/attributes/${attribute.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${attribute.name}`}
                    title="Edit attribute"
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
