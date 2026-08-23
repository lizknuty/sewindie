import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { ArrowLeft, Users, UserPlus, Sparkles, Heart, Star, TrendingUp } from "lucide-react"
import { prisma } from "@/lib/prisma"

const MONTHS_BACK = 12

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

async function getUsersAnalytics() {
  const now = new Date()

  // Window start = first day of the month MONTHS_BACK-1 months ago, in UTC to
  // match the timestamps Postgres returns.
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1), 1))
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [totalUsers, newLast30, statusGroups, signupRows, favoriteGroups, ratingGroups, recentSignups] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: windowStart } },
        select: { createdAt: true },
      }),
      // Grouping by user gives both the leaderboard and the distinct-user count
      // for engagement, so no extra queries are needed.
      prisma.favorite.groupBy({
        by: ["userId"],
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
      }),
      prisma.rating.groupBy({
        by: ["userId"],
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
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
          _count: { select: { favorites: true, ratings: true } },
        },
      }),
    ])

  // Bucket signups by month in JS to keep this portable instead of hand-writing
  // date_trunc SQL against the pooled connection.
  const counts = new Map<string, number>()
  for (const row of signupRows) {
    const key = monthKey(new Date(row.createdAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const signupsByMonth = Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS_BACK - 1 - i), 1))
    const key = monthKey(d)
    return {
      key,
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      year: d.getUTCFullYear(),
      count: counts.get(key) ?? 0,
    }
  })

  const topFavoriters = favoriteGroups.slice(0, 8)
  const topRaters = ratingGroups.slice(0, 8)

  // Engagement = users who have favorited or rated at least once. This is the
  // real activity signal available; User.lastLogin is never written by the app.
  const favoriteUserIds = new Set(favoriteGroups.map((r) => r.userId))
  const ratingUserIds = new Set(ratingGroups.map((r) => r.userId))
  const engagedIds = new Set([...favoriteUserIds, ...ratingUserIds])

  // Resolve the users behind both leaderboards in a single query.
  const leaderboardIds = Array.from(new Set([...topFavoriters, ...topRaters].map((r) => r.userId)))
  const leaderboardUsers = leaderboardIds.length
    ? await prisma.user.findMany({
        where: { id: { in: leaderboardIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userById = new Map(leaderboardUsers.map((u) => [u.id, u]))

  const statusCounts = statusGroups.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = g._count.status
    return acc
  }, {})

  return {
    totalUsers,
    newLast30,
    statusCounts,
    signupsByMonth,
    engagedUsers: engagedIds.size,
    favoritedUsers: favoriteUserIds.size,
    ratedUsers: ratingUserIds.size,
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
    statusCounts,
    signupsByMonth,
    engagedUsers,
    favoritedUsers,
    ratedUsers,
    topFavoriters,
    topRaters,
    recentSignups,
  } = await getUsersAnalytics()

  const peakSignups = Math.max(...signupsByMonth.map((m) => m.count), 1)
  const pctOf = (n: number) => (totalUsers > 0 ? Math.round((n / totalUsers) * 100) : 0)

  const engagementRows = [
    { label: "Favorited a pattern", count: favoritedUsers },
    { label: "Rated a pattern", count: ratedUsers },
    { label: "Did either", count: engagedUsers },
  ]

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
              <Sparkles size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Engaged Users</span>
          </div>
          <div className="admin-metric-value">{engagedUsers.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">
            {pctOf(engagedUsers)}% have favorited or rated
          </div>
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
              const pct = pctOf(count)
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
            <h2 className="admin-panel-title">Engagement</h2>
            <span className="admin-row-sub">Share of all users</span>
          </div>
          <div className="admin-bars">
            {engagementRows.map((row) => {
              const pct = pctOf(row.count)
              return (
                <div key={row.label} className="admin-bar-row">
                  <div className="admin-bar-meta">
                    <span className="admin-bar-label">{row.label}</span>
                    <span className="admin-bar-value">
                      {row.count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="admin-bar-track">
                    <div
                      className={`admin-bar-fill ${
                        pct >= 60 ? "admin-bar-fill--good" : pct >= 25 ? "admin-bar-fill--warn" : "admin-bar-fill--bad"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
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
