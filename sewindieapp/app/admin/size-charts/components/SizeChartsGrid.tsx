import Link from "next/link"
import { Pencil, Ruler } from "lucide-react"
import type { AdminSizeChart } from "@/admin/size-charts/types"

export default function SizeChartsGrid({ sizeCharts }: { sizeCharts: AdminSizeChart[] }) {
  return (
    <div className="patterns-grid">
      {sizeCharts.map((chart) => (
        <div key={chart.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Ruler size={18} />
            </div>
            <h3 className="pattern-card-title">{chart.label}</h3>
            <p className="pattern-card-designer">{chart.Designer?.name ?? "—"}</p>
            <div className="user-card-meta">
              <span className="role-pill">{chart.measurement_unit}</span>
              <span className="designer-pattern-count">{chart._count?.SizeChartRow ?? 0} sizes</span>
            </div>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{chart._count?.PatternSizeChart ?? 0} patterns</span>
              <Link
                href={`/admin/size-charts/${chart.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${chart.label}`}
                title="Edit size chart"
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
