import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminFabricType } from "@/admin/fabric-types/types"

export default function FabricTypesTable({ fabricTypes }: { fabricTypes: AdminFabricType[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Fabric Type</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fabricTypes.map((fabricType) => (
            <tr key={fabricType.id}>
              <td>
                <span className="pattern-name">{fabricType.name}</span>
              </td>
              <td className="text-end text-muted-cell">{fabricType._count?.PatternFabricType ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/fabric-types/${fabricType.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${fabricType.name}`}
                    title="Edit fabric type"
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
