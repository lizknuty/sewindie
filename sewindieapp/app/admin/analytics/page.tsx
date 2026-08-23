import Link from "next/link"
import { Heart, Users, ClipboardCheck, Star, Scissors, Palette, ArrowRight, BarChart3 } from "lucide-react"
import { prisma } from "@/lib/prisma"
import MetricCard from "@/admin/components/dashboard/MetricCard"

async function getAnalyticsSummary() {
  const [totalFavorites, totalRatings, totalPatterns, totalUsers, totalDesigners] = await Promise.all([
    prisma.favorite.count(),
    prisma.rating.count(),
    prisma.pattern.count(),
    prisma.user.count(),
    prisma.designer.count(),
  ])

  return { totalFavorites, totalRatings, totalPatterns, totalUsers, totalDesigners }
}

const REPORTS = [
  {
    href: "/admin/analytics/favorites",
    icon: Heart,
    title: "Favorites",
    sub: "Most-saved patterns, the users saving them, and recent save activity.",
  },
  {
    href: "/admin/analytics/ratings",
    icon: Star,
    title: "Ratings",
    sub: "Score distribution, highest-rated patterns, and your most active raters.",
  },
  {
    href: "/admin/analytics/users",
    icon: Users,
    title: "Users",
    sub: "Signups over time, account status, and your most engaged members.",
  },
  {
    href: "/admin/analytics/content",
    icon: ClipboardCheck,
    title: "Content Coverage",
    sub: "Catalogue gaps by field and the patterns that need attention first.",
  },
]

export default async function AnalyticsPage() {
  const { totalFavorites, totalRatings, totalPatterns, totalUsers, totalDesigners } = await getAnalyticsSummary()

  return (
    <div className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-sub">Engagement across patterns, designers, and the people using SewIndie.</p>
        </div>
        <span className="admin-daterange">
          <BarChart3 size={15} strokeWidth={1.75} />
          All time
        </span>
      </div>

      <div className="admin-metrics">
        <MetricCard label="Patterns" value={totalPatterns} icon={Scissors} href="/admin/patterns" subtitle="Total patterns" />
        <MetricCard label="Designers" value={totalDesigners} icon={Palette} href="/admin/designers" subtitle="Total designers" />
        <MetricCard label="Users" value={totalUsers} icon={Users} href="/admin/users" subtitle="Registered users" />
        <MetricCard
          label="Favorites"
          value={totalFavorites}
          icon={Heart}
          href="/admin/analytics/favorites"
          subtitle="Patterns saved"
        />
        <MetricCard
          label="Ratings"
          value={totalRatings}
          icon={Star}
          href="/admin/analytics/ratings"
          subtitle="Ratings submitted"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Reports</h2>
        </div>
        <div className="admin-report-grid">
            {REPORTS.map(({ href, icon: Icon, title, sub }) =>
              href ? (
                <Link key={title} href={href} className="admin-report-card">
                  <span className="admin-report-icon">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3 className="admin-report-title">{title}</h3>
                  <p className="admin-report-sub">{sub}</p>
                  <span className="admin-report-cta">
                    View report <ArrowRight size={14} strokeWidth={2} />
                  </span>
                </Link>
              ) : (
                <div key={title} className="admin-report-card is-soon" aria-disabled="true">
                  <span className="admin-report-icon">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3 className="admin-report-title">{title}</h3>
                  <p className="admin-report-sub">{sub}</p>
                  <span className="admin-soon-tag">Not built yet</span>
                </div>
            ),
          )}
        </div>
      </section>
    </div>
  )
}
