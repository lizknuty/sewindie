import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Heart, TrendingUp, Users, ArrowLeft, Scissors } from "lucide-react"
import { prisma } from "@/lib/prisma"

async function getFavoritesAnalytics() {
  // Get top favorited patterns
  const topPatterns = await prisma.favorite.groupBy({
    by: ["patternId"],
    _count: {
      patternId: true,
    },
    orderBy: {
      _count: {
        patternId: "desc",
      },
    },
    take: 10,
  })

  // Get patterns details
  const patternIds = topPatterns.map((p) => p.patternId)
  const patterns = await prisma.pattern.findMany({
    where: {
      id: {
        in: patternIds,
      },
    },
    include: {
      designer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Combine data
  const topFavoritedPatterns = topPatterns.map((tp) => {
    const pattern = patterns.find((p) => p.id === tp.patternId)
    return {
      pattern,
      favoriteCount: tp._count.patternId,
    }
  })

  // Get recent favorites activity
  const recentFavorites = await prisma.favorite.findMany({
    take: 20,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      pattern: {
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  // Get total favorites count
  const totalFavorites = await prisma.favorite.count()

  // Get users with most favorites
  const topUsers = await prisma.favorite.groupBy({
    by: ["userId"],
    _count: {
      userId: true,
    },
    orderBy: {
      _count: {
        userId: "desc",
      },
    },
    take: 10,
  })

  // Get users details
  const userIds = topUsers.map((u) => u.userId)
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  // Combine data
  const topFavoritingUsers = topUsers.map((tu) => {
    const user = users.find((u) => u.id === tu.userId)
    return {
      user,
      favoriteCount: tu._count.userId,
    }
  })

  return {
    topFavoritedPatterns,
    recentFavorites,
    totalFavorites,
    topFavoritingUsers,
  }
}

export default async function FavoritesAnalyticsPage() {
  const { topFavoritedPatterns, recentFavorites, totalFavorites, topFavoritingUsers } = await getFavoritesAnalytics()

  const uniqueSavers = topFavoritingUsers.length

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Favorites</h1>
          <p className="admin-page-sub">Which patterns people are saving, and who is saving them.</p>
        </div>
      </div>

      <div className="admin-metrics admin-metrics--3">
        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Heart size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Total Favorites</span>
          </div>
          <div className="admin-metric-value">{totalFavorites.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Patterns saved</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Scissors size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Patterns Saved</span>
          </div>
          <div className="admin-metric-value">{topFavoritedPatterns.length.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">In the top 10</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Top Savers</span>
          </div>
          <div className="admin-metric-value">{uniqueSavers.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Most active users</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <TrendingUp size={16} strokeWidth={1.75} /> Top Favorited Patterns
            </h2>
          </div>
          {topFavoritedPatterns.length === 0 ? (
            <p className="admin-empty">No favorites yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th className="admin-num">Favorites</th>
                </tr>
              </thead>
              <tbody>
                {topFavoritedPatterns.map(({ pattern, favoriteCount }) => (
                  <tr key={pattern?.id ?? `missing-${favoriteCount}`}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">
                            {pattern ? (
                              <Link href={`/admin/patterns/${pattern.id}/edit`}>{pattern.name}</Link>
                            ) : (
                              "Deleted pattern"
                            )}
                          </p>
                          <p className="admin-row-sub">{pattern?.designer?.name ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{favoriteCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="admin-panel-foot">
            <Link href="/admin/patterns" className="admin-ghost-btn">
              View all patterns
            </Link>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Users size={16} strokeWidth={1.75} /> Top Users by Favorites
            </h2>
          </div>
          {topFavoritingUsers.length === 0 ? (
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
                {topFavoritingUsers.map(({ user, favoriteCount }) => (
                  <tr key={user?.id ?? `missing-${favoriteCount}`}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">{user?.name ?? "Deleted user"}</p>
                          <p className="admin-row-sub">{user?.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{favoriteCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="admin-panel-foot">
            <Link href="/admin/users" className="admin-ghost-btn">
              View all users
            </Link>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Recent Favorite Activity</h2>
        </div>
        {recentFavorites.length === 0 ? (
          <p className="admin-empty">No recent activity.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Pattern</th>
                <th>Designer</th>
                <th className="admin-num">When</th>
              </tr>
            </thead>
            <tbody>
              {recentFavorites.map((favorite) => (
                <tr key={`${favorite.userId}-${favorite.patternId}-${favorite.createdAt.toString()}`}>
                  <td>{favorite.user.name}</td>
                  <td>
                    <Link href={`/admin/patterns/${favorite.pattern.id}/edit`}>{favorite.pattern.name}</Link>
                  </td>
                  <td>{favorite.pattern.designer?.name ?? "—"}</td>
                  <td className="admin-num">
                    {formatDistanceToNow(new Date(favorite.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
