import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminSuggestedFabric } from "@/admin/suggested-fabrics/types"

export default function SuggestedFabricsTable({ suggestedFabrics }: { suggestedFabrics: AdminSuggestedFabric[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Suggested Fabric</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {suggestedFabrics.map((fabric) => (
            <tr key={fabric.id}>
              <td>
                <span className="pattern-name">{fabric.name}</span>
              </td>
              <td className="text-end text-muted-cell">{fabric._count?.PatternSuggestedFabric ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/suggested-fabrics/${fabric.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${fabric.name}`}
                    title="Edit suggested fabric"
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
