import Link from "next/link"
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react"
import type { Trend } from "@/admin/lib/dashboard-data"

interface MetricCardProps {
  label: string
  value: number
  icon: LucideIcon
  href: string
  trend?: Trend
  subtitle?: string
}

export default function MetricCard({ label, value, icon: Icon, href, trend, subtitle }: MetricCardProps) {
  return (
    <Link href={href} className="admin-metric">
      <div className="admin-metric-head">
        <span className="admin-metric-icon">
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="admin-metric-label">{label}</span>
      </div>
      <div className="admin-metric-value">{value.toLocaleString()}</div>
      {trend ? (
        <div className={`admin-metric-trend admin-metric-trend--${trend.direction}`}>
          {trend.direction === "up" && <TrendingUp size={14} strokeWidth={2} />}
          {trend.direction === "down" && <TrendingDown size={14} strokeWidth={2} />}
          {trend.direction === "flat" && <Minus size={14} strokeWidth={2} />}
          <span>
            {trend.pct}% <span className="admin-metric-trend-note">vs last 7 days</span>
          </span>
        </div>
      ) : (
        <div className="admin-metric-trend admin-metric-trend--muted">{subtitle ?? "Total"}</div>
      )}
    </Link>
  )
}
