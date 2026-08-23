import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { ArrowLeft, Users, UserPlus, Activity, Heart, Star, TrendingUp, Ruler } from "lucide-react"
import { prisma } from "@/lib/prisma"

const MONTHS_BACK = 12

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

async function getUsersAnalytics() {
  const now = new Date()

  // Window start = first day of the month, MONTHS_BACK - 1 months ago (UTC to
  // match the timestamps Postgres hands back).
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1), 1))
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    newLast30,
    activeLast30,
    statusGroups,
    signupRows,
    withMeasurements,
    topFavoriters,
    topRaters,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { lastLogin: { gte: thirtyDaysAgo } } }),
    prisma.user.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),
    prisma.userMeasurement.findMany({ select: { user_id: true }, distinct: ["user_id"] }),
    prisma.favorite.groupBy({
      by: ["userId"],
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 8,
    }),
    prisma.rating.groupBy({
      by: ["userId"],
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 8,
    }),
    prisma.user.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        lastLogin: true,
        _count: { select: { favorites: true, ratings: true } },
      },
    }),
  ])

  // Bucket signups into months in JS rather than with $queryRaw so this stays
  // portable and avoids hand-written SQL against the pooled connection.
  const counts = new Map<string, number>()
  for (const row of signupRows) {
    const key = monthKey(new Date(row.createdAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const signupsByMonth = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1 - i), 1))
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      year: d.getUTCFullYear(),
      count: counts.get(monthKey(d)) ?? 0,
    }
  })

  // Resolve the user records behind the engagement leaderboards in one query
  // each rather than N per row.
  const engagementIds = Array.from(
    new Set([...topFavoriters.map((r) => r.userId), ...topRaters.map((r) => r.userId)]),
  )
  const engagementUsers = engagementIds.length
    ? await prisma.user.findMany({
        where: { id: { in: engagementIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userById = new Map(engagementUsers.map((u) => [u.id, u]))

  const statusCounts = statusGroups.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = g._count.status
    return acc
  }, {})

  return {
    totalUsers,
    newLast30,
    activeLast30,
    statusCounts,
    signupsByMonth,
    measurementUsers: withMeasurements.length,
    topFavoriters: topFavoriters.map((r) => ({ user: userById.get(r.userId), count: r._count.userId })),
    topRaters: topRaters.map((r) => ({ user: userById.get(r.userId), count: r._count.userId })),
    recentSignups,
  }
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: "Active", dot: "status-dot-active" },
  PENDING: { label: "Pending", dot: "status-dot-pending" },
  SUSPENDED: { label: "Suspended", dot: "status-dot-suspended" },
}

export default async function UsersAnalyticsPage() {
  const {
    totalUsers,
    newLast30,
    activeLast30,
    statusCounts,
    signupsByMonth,
    measurementUsers,
    topFavoriters,
    topRaters,
    recentSignups,
  } = await getUsersAnalytics()

  const peakSignups = Math.max(...signupsByMonth.map((m) => m.count), 1)
  const profilePct = totalUsers > 0 ? Math.round((measurementUsers / totalUsers) * 100) : 0

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-sub">Registrations, account health, and who is engaging most.</p>
        </div>
      </div>

      <div className="admin-metrics admin-metrics--3">
        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Total Users</span>
          </div>
          <div className="admin-metric-value">{totalUsers.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">All registered accounts</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <UserPlus size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">New (30 days)</span>
          </div>
          <div className="admin-metric-value">{newLast30.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Signed up recently</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Activity size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Active (30 days)</span>
          </div>
          <div className="admin-metric-value">{activeLast30.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Logged in recently</div>
        </div>
      </div>

      <section className="admin-panel" style={{ marginBottom: "1.5rem" }}>
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">
            <TrendingUp size={16} strokeWidth={1.75} /> Signups by Month
          </h2>
          <span className="admin-row-sub">Last {MONTHS_BACK} months</span>
        </div>
        <div className="admin-columns">
          {signupsByMonth.map((m) => (
            <div key={m.key} className="admin-column" title={`${m.count} signups in ${m.label} ${m.year}`}>
              <span className="admin-column-value">{m.count}</span>
              <div
                className={`admin-column-bar${m.count === 0 ? " is-empty" : ""}`}
                style={{ height: `${(m.count / peakSignups) * 100}%` }}
              />
              <span className="admin-column-label">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Account Status</h2>
          </div>
          <div className="admin-bars">
            {Object.entries(STATUS_META).map(([status, meta]) => {
              const count = statusCounts[status] ?? 0
              const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
              return (
                <div key={status} className="admin-bar-row">
                  <div className="admin-bar-meta">
                    <span className="admin-bar-label">
                      <span className={`status-dot ${meta.dot}`} />
                      {meta.label}
                    </span>
                    <span className="admin-bar-value">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="admin-bar-track">
                    <div className="admin-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="admin-panel-foot">
            <Link href="/admin/users" className="admin-ghost-btn">
              Manage users
            </Link>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Ruler size={16} strokeWidth={1.75} /> Profile Completion
            </h2>
          </div>
          <div className="admin-bars">
            <div className="admin-bar-row">
              <div className="admin-bar-meta">
                <span className="admin-bar-label">Saved measurements</span>
                <span className="admin-bar-value">
                  {measurementUsers.toLocaleString()} of {totalUsers.toLocaleString()} ({profilePct}%)
                </span>
              </div>
              <div className="admin-bar-track">
                <div
                  className={`admin-bar-fill ${
                    profilePct >= 60 ? "admin-bar-fill--good" : profilePct >= 25 ? "admin-bar-fill--warn" : "admin-bar-fill--bad"
                  }`}
                  style={{ width: `${profilePct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="admin-row-sub" style={{ marginTop: "0.75rem" }}>
            Users with saved body measurements get size recommendations, so this is a useful proxy for how invested
            your audience is.
          </p>
        </section>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Heart size={16} strokeWidth={1.75} /> Top Users by Favorites
            </h2>
          </div>
          {topFavoriters.length === 0 ? (
            <p className="admin-empty">No favorites yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="admin-num">Favorites</th>
                </tr>
              </thead>
              <tbody>
                {topFavoriters.map(({ user, count }, i) => (
                  <tr key={user?.id ?? `fav-${i}`}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">{user?.name ?? "Deleted user"}</p>
                          <p className="admin-row-sub">{user?.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Star size={16} strokeWidth={1.75} /> Top Users by Ratings
            </h2>
          </div>
          {topRaters.length === 0 ? (
            <p className="admin-empty">No ratings yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="admin-num">Ratings</th>
                </tr>
              </thead>
              <tbody>
                {topRaters.map(({ user, count }, i) => (
                  <tr key={user?.id ?? `rate-${i}`}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">{user?.name ?? "Deleted user"}</p>
                          <p className="admin-row-sub">{user?.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Recent Signups</h2>
          <Link href="/admin/users" className="admin-panel-link">
            View all users
          </Link>
        </div>
        {recentSignups.length === 0 ? (
          <p className="admin-empty">No users yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th className="admin-num">Favorites</th>
                <th className="admin-num">Ratings</th>
                <th className="admin-num">Last login</th>
                <th className="admin-num">Joined</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map((user) => {
                const meta = STATUS_META[user.status] ?? { label: user.status, dot: "" }
                return (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">{user.name ?? "—"}</p>
                          <p className="admin-row-sub">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="user-status">
                        <span className={`status-dot ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="admin-num">{user._count.favorites}</td>
                    <td className="admin-num">{user._count.ratings}</td>
                    <td className="admin-num">
                      {user.lastLogin ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true }) : "Never"}
                    </td>
                    <td className="admin-num">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
