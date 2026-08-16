import Link from "next/link"
import { Scissors, UserPlus, Users, BarChart3, FileText, Sprout, type LucideIcon } from "lucide-react"

const ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Add Pattern", href: "/admin/patterns", icon: Scissors },
  { label: "Add Designer", href: "/admin/designers", icon: UserPlus },
  { label: "Manage Users", href: "/admin/users", icon: Users },
  { label: "View Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Create Blog Post", href: "/admin/blog", icon: FileText },
  { label: "View Contributions", href: "/admin/contributions", icon: Sprout },
]

export default function QuickActions() {
  return (
    <section className="admin-panel admin-quick">
      <h2 className="admin-panel-title admin-quick-title">Quick Actions</h2>
      <div className="admin-quick-grid">
        {ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link key={label} href={href} className="admin-quick-btn">
            <span className="admin-quick-icon">
              <Icon size={18} strokeWidth={1.75} />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </section>
  )
}
