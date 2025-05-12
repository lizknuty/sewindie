import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Star, TrendingUp, Users, BarChart2 } from "lucide-react"
import prisma from "@/lib/prisma"

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

  return (
    <div>
      <h1 className="mb-4">Ratings Analytics</h1>

      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Total Ratings</h5>
              <div className="d-flex align-items-center">
                <Star size={24} className="me-2 text-warning" />
                <p className="card-text display-4 mb-0">{totalRatings}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center">
              <TrendingUp size={18} className="me-2" />
              <h5 className="mb-0">Top Rated Patterns</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Pattern</th>
                      <th>Designer</th>
                      <th>Rating</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRatedPatterns.map((pattern) => (
                      <tr key={pattern.id}>
                        <td>
                          <Link href={`/admin/patterns/${pattern.id}/edit`}>{pattern.name}</Link>
                        </td>
                        <td>{pattern.designer?.name}</td>
                        <td>
                          <div className="d-flex align-items-center">
                            <Star size={16} className="text-warning me-1" />
                            <span>{pattern.averageRating}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-secondary">{pattern.ratingCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center">
              <BarChart2 size={18} className="me-2" />
              <h5 className="mb-0">Rating Distribution</h5>
            </div>
            <div className="card-body">
              {Object.entries(ratingDistribution)
                .sort((a, b) => Number.parseInt(b[0]) - Number.parseInt(a[0]))
                .map(([score, count]) => {
                  const percentage = totalDistribution > 0 ? (count / totalDistribution) * 100 : 0
                  return (
                    <div key={score} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <div>
                          {Array.from({ length: Number.parseInt(score) }).map((_, i) => (
                            <Star key={i} size={16} className="text-warning me-1" />
                          ))}
                          <span className="ms-1">{score} stars</span>
                        </div>
                        <div>
                          {count} ({percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div className="progress" style={{ height: "10px" }}>
                        <div
                          className="progress-bar bg-warning"
                          role="progressbar"
                          style={{ width: `${percentage}%` }}
                          aria-valuenow={percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        ></div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex align-items-center">
              <Users size={18} className="me-2" />
              <h5 className="mb-0">Top Rating Users</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Ratings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRatingUsers.map(({ user, ratingCount }) => (
                      <tr key={user?.id}>
                        <td>{user?.name}</td>
                        <td>{user?.email}</td>
                        <td>
                          <span className="badge bg-primary">{ratingCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Recent Rating Activity</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Pattern</th>
                  <th>Designer</th>
                  <th>Rating</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentRatings.map((rating) => (
                  <tr key={rating.id}>
                    <td>{rating.user.name}</td>
                    <td>
                      <Link href={`/admin/patterns/${rating.pattern.id}/edit`}>{rating.pattern.name}</Link>
                    </td>
                    <td>{rating.pattern.designer?.name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        {Array.from({ length: rating.score }).map((_, i) => (
                          <Star key={i} size={16} className="text-warning" />
                        ))}
                      </div>
                    </td>
                    <td>{formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
