import Link from "next/link"
import { UserPlus, Heart, Star, FileText, ArrowRight, type LucideIcon } from "lucide-react"
import { formatTimeAgo, type ActivityItem, type ActivityKind } from "@/admin/lib/dashboard-data"

const ICONS: Record<ActivityKind, LucideIcon> = {
  user: UserPlus,
  favorite: Heart,
  rating: Star,
  blog: FileText,
}

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2 className="admin-panel-title">Recent Activity</h2>
        <Link href="/admin/analytics" className="admin-panel-link">
          View all activity <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="admin-empty">No recent activity yet.</p>
      ) : (
        <ul className="admin-activity">
          {items.map((item) => {
            const Icon = ICONS[item.kind]
            return (
              <li key={item.id} className="admin-activity-item">
                <span className="admin-activity-icon">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <div className="admin-activity-body">
                  <p className="admin-activity-title">{item.title}</p>
                  <p className="admin-activity-sub">{item.subtitle}</p>
                </div>
                <span className="admin-activity-time">{formatTimeAgo(item.timestamp)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
