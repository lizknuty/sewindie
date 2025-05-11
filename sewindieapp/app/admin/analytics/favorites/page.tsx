import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Heart, TrendingUp, Users } from "lucide-react"
import prisma from "@/lib/prisma"

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

  return (
    <div>
      <h1 className="mb-4">Favorites Analytics</h1>

      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Total Favorites</h5>
              <div className="d-flex align-items-center">
                <Heart size={24} className="me-2 text-danger" />
                <p className="card-text display-4 mb-0">{totalFavorites}</p>
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
              <h5 className="mb-0">Top Favorited Patterns</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Pattern</th>
                      <th>Designer</th>
                      <th>Favorites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFavoritedPatterns.map(({ pattern, favoriteCount }) => (
                      <tr key={pattern?.id}>
                        <td>
                          <Link href={`/admin/patterns/${pattern?.id}/edit`}>{pattern?.name}</Link>
                        </td>
                        <td>{pattern?.designer?.name}</td>
                        <td>
                          <span className="badge bg-danger">{favoriteCount}</span>
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
              <Users size={18} className="me-2" />
              <h5 className="mb-0">Top Users by Favorites</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Favorites</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topFavoritingUsers.map(({ user, favoriteCount }) => (
                      <tr key={user?.id}>
                        <td>{user?.name}</td>
                        <td>{user?.email}</td>
                        <td>
                          <span className="badge bg-primary">{favoriteCount}</span>
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
          <h5 className="mb-0">Recent Favorite Activity</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Pattern</th>
                  <th>Designer</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentFavorites.map((favorite) => (
                  <tr key={`${favorite.userId}-${favorite.patternId}-${favorite.createdAt.toString()}`}>
                    <td>{favorite.user.name}</td>
                    <td>
                      <Link href={`/admin/patterns/${favorite.pattern.id}/edit`}>{favorite.pattern.name}</Link>
                    </td>
                    <td>{favorite.pattern.designer?.name}</td>
                    <td>{formatDistanceToNow(new Date(favorite.createdAt), { addSuffix: true })}</td>
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
