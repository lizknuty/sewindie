import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { Users, Scissors, FileText, Sprout, Palette, Calendar } from "lucide-react"
import { getDashboardData } from "@/admin/lib/dashboard-data"
import MetricCard from "@/admin/components/dashboard/MetricCard"
import RecentActivity from "@/admin/components/dashboard/RecentActivity"
import TopContent from "@/admin/components/dashboard/TopContent"
import QuickActions from "@/admin/components/dashboard/QuickActions"

export default async function AdminDashboard() {
  const [session, data] = await Promise.all([getServerSession(authOptions), getDashboardData()])

  const firstName = session?.user?.name?.split(" ")[0] || "there"
  const { metrics, activity, topPatterns, topDesigners } = data

  return (
    <div className="admin-dashboard">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">Welcome back, {firstName}! Here&apos;s what&apos;s happening with SewIndie.</p>
        </div>
        <span className="admin-daterange">
          <Calendar size={15} strokeWidth={1.75} />
          Last 7 days
        </span>
      </div>

      <div className="admin-metrics">
        <MetricCard label="Users" value={metrics.users.value} icon={Users} href="/admin/users" trend={metrics.users.trend} />
        <MetricCard label="Designers" value={metrics.designers.value} icon={Palette} href="/admin/designers" subtitle="Total designers" />
        <MetricCard label="Patterns" value={metrics.patterns.value} icon={Scissors} href="/admin/patterns" subtitle="Total patterns" />
        <MetricCard label="Blog Posts" value={metrics.blogPosts.value} icon={FileText} href="/admin/blog" trend={metrics.blogPosts.trend} />
        <MetricCard label="Contributions" value={metrics.contributions.value} icon={Sprout} href="/admin/contributions" subtitle="Submissions" />
      </div>

      <div className="admin-grid-2">
        <RecentActivity items={activity} />
        <TopContent patterns={topPatterns} designers={topDesigners} />
      </div>

      <QuickActions />
    </div>
  )
}
