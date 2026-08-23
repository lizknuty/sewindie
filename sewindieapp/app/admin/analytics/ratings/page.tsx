import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Star, TrendingUp, Users, BarChart2, ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"

// Define types to match Prisma schema
type PatternWithRatings = {
  id: number
  name: string
  designer: {
    id: number
    name: string
  } | null
  ratings: {
    score: number
  }[]
  _count: {
    ratings: number
  }
}

type RatingWithRelations = {
  id: number
  score: number
  createdAt: Date
  user: {
    id: number
    name: string
    email: string
  }
  pattern: {
    id: number
    name: string
    designer: {
      id: number
      name: string
    } | null
  }
}

type RatingDistribution = {
  score: number
  _count: number
}

type UserWithCount = {
  user:
    | {
        id: number
        name: string
        email: string
      }
    | undefined
  ratingCount: number
}

async function getRatingsAnalytics() {
  // Get top rated patterns
  const topRatedPatterns = (await prisma.pattern.findMany({
    where: {
      ratings: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      designer: {
        select: {
          id: true,
          name: true,
        },
      },
      ratings: {
        select: {
          score: true,
        },
      },
      _count: {
        select: {
          ratings: true,
        },
      },
    },
    orderBy: [
      {
        ratings: {
          // Fix ordering syntax
          _count: "desc",
        },
      },
    ],
    take: 10,
  })) as unknown as PatternWithRatings[]

  // Calculate average ratings
  const patternsWithAvgRating = topRatedPatterns.map((pattern) => {
    const totalScore = pattern.ratings.reduce((sum: number, rating: { score: number }) => sum + rating.score, 0)
    const avgRating = pattern.ratings.length > 0 ? totalScore / pattern.ratings.length : 0

    return {
      id: pattern.id,
      name: pattern.name,
      designer: pattern.designer,
      averageRating: Number.parseFloat(avgRating.toFixed(2)),
      ratingCount: pattern._count.ratings,
    }
  })

  // Get recent ratings activity
  const recentRatings = (await prisma.rating.findMany({
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
  })) as unknown as RatingWithRelations[]

  // Get total ratings count
  const totalRatings = await prisma.rating.count()

  // Get rating distribution
  const ratingDistribution = (await prisma.rating.groupBy({
    by: ["score"],
    _count: true,
    orderBy: {
      score: "desc",
    },
  })) as unknown as RatingDistribution[]

  // Format distribution for easier consumption
  const distribution: Record<string, number> = {
    "5": 0,
    "4": 0,
    "3": 0,
    "2": 0,
    "1": 0,
  }

  ratingDistribution.forEach((item) => {
    // Convert number to string for indexing
    const scoreKey = item.score.toString() as keyof typeof distribution
    distribution[scoreKey] = item._count
  })

  // Get users with most ratings
  const topRaters = await prisma.rating.groupBy({
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
  const userIds = topRaters.map((u) => u.userId)
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
  const topRatingUsers = topRaters.map((tu) => {
    const user = users.find((u) => u.id === tu.userId)
    return {
      user,
      ratingCount: tu._count.userId,
    }
  }) as UserWithCount[]

  return {
    topRatedPatterns: patternsWithAvgRating,
    recentRatings,
    totalRatings,
    ratingDistribution: distribution,
    topRatingUsers,
  }
}

export default async function RatingsAnalyticsPage() {
  const { topRatedPatterns, recentRatings, totalRatings, ratingDistribution, topRatingUsers } =
    await getRatingsAnalytics()

  // Calculate total for distribution percentage
  const totalDistribution = Object.values(ratingDistribution).reduce((sum, count) => sum + count, 0)

  // Weighted mean score across every rating
  const weightedTotal = Object.entries(ratingDistribution).reduce(
    (sum, [score, count]) => sum + Number.parseInt(score) * count,
    0,
  )
  const meanScore = totalDistribution > 0 ? (weightedTotal / totalDistribution).toFixed(2) : "—"

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Ratings</h1>
          <p className="admin-page-sub">How patterns are scoring, and who is doing the rating.</p>
        </div>
      </div>

      <div className="admin-metrics admin-metrics--3">
        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Star size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Total Ratings</span>
          </div>
          <div className="admin-metric-value">{totalRatings.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Ratings submitted</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <BarChart2 size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Average Score</span>
          </div>
          <div className="admin-metric-value">{meanScore}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Out of 5</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Users size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Top Raters</span>
          </div>
          <div className="admin-metric-value">{topRatingUsers.length.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Most active users</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <TrendingUp size={16} strokeWidth={1.75} /> Top Rated Patterns
            </h2>
          </div>
          {topRatedPatterns.length === 0 ? (
            <p className="admin-empty">No ratings yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th className="admin-num">Score</th>
                  <th className="admin-num">Ratings</th>
                </tr>
              </thead>
              <tbody>
                {topRatedPatterns.map((pattern) => (
                  <tr key={pattern.id}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">
                            <Link href={`/admin/patterns/${pattern.id}/edit`}>{pattern.name}</Link>
                          </p>
                          <p className="admin-row-sub">{pattern.designer?.name ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-score">
                        <Star size={14} strokeWidth={2} fill="currentColor" className="admin-stars" />
                        {pattern.averageRating}
                      </span>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{pattern.ratingCount}</span>
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
              <BarChart2 size={16} strokeWidth={1.75} /> Rating Distribution
            </h2>
          </div>
          {totalDistribution === 0 ? (
            <p className="admin-empty">No ratings yet.</p>
          ) : (
            <div className="admin-bars">
              {Object.entries(ratingDistribution)
                .sort((a, b) => Number.parseInt(b[0]) - Number.parseInt(a[0]))
                .map(([score, count]) => {
                  const percentage = totalDistribution > 0 ? (count / totalDistribution) * 100 : 0
                  return (
                    <div key={score} className="admin-bar-row">
                      <div className="admin-bar-meta">
                        <span className="admin-bar-label">
                          <span className="admin-stars" aria-hidden="true">
                            {Array.from({ length: Number.parseInt(score) }).map((_, i) => (
                              <Star key={i} size={13} strokeWidth={2} fill="currentColor" />
                            ))}
                          </span>
                          {score} {Number.parseInt(score) === 1 ? "star" : "stars"}
                        </span>
                        <span className="admin-bar-value">
                          {count.toLocaleString()} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div
                        className="admin-bar-track"
                        role="img"
                        aria-label={`${score} stars: ${count} ratings, ${percentage.toFixed(1)} percent`}
                      >
                        <div className="admin-bar-fill" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </section>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Users size={16} strokeWidth={1.75} /> Top Rating Users
            </h2>
          </div>
          {topRatingUsers.length === 0 ? (
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
                {topRatingUsers.map(({ user, ratingCount }) => (
                  <tr key={user?.id ?? `missing-${ratingCount}`}>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">{user?.name ?? "Deleted user"}</p>
                          <p className="admin-row-sub">{user?.email ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{ratingCount}</span>
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

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Recent Rating Activity</h2>
          </div>
          {recentRatings.length === 0 ? (
            <p className="admin-empty">No recent activity.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Pattern</th>
                  <th className="admin-num">Score</th>
                  <th className="admin-num">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRatings.map((rating) => (
                  <tr key={rating.id}>
                    <td>{rating.user.name}</td>
                    <td>
                      <div className="admin-row-item">
                        <div>
                          <p className="admin-row-title">
                            <Link href={`/admin/patterns/${rating.pattern.id}/edit`}>{rating.pattern.name}</Link>
                          </p>
                          <p className="admin-row-sub">{rating.pattern.designer?.name ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="admin-num">
                      <span className="admin-score">
                        <Star size={14} strokeWidth={2} fill="currentColor" className="admin-stars" />
                        {rating.score}
                      </span>
                    </td>
                    <td className="admin-num">
                      {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
