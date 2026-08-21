import Link from "next/link"
import { Pencil } from "lucide-react"
import type { AdminSizeChart } from "@/admin/size-charts/types"

export default function SizeChartsTable({ sizeCharts }: { sizeCharts: AdminSizeChart[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Designer</th>
            <th>Unit</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Sizes</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sizeCharts.map((chart) => (
            <tr key={chart.id}>
              <td>
                <span className="pattern-name">{chart.label}</span>
              </td>
              <td className="text-muted-cell">{chart.Designer?.name ?? "—"}</td>
              <td>
                <span className="role-pill">{chart.measurement_unit}</span>
              </td>
              <td className="text-end text-muted-cell">{chart._count?.PatternSizeChart ?? 0}</td>
              <td className="text-end text-muted-cell">{chart._count?.SizeChartRow ?? 0}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/size-charts/${chart.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${chart.label}`}
                    title="Edit size chart"
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
