import Link from "next/link"
import { Heart, TrendingUp, Users, Search, Star } from "lucide-react"
import prisma from "@/lib/prisma"

async function getAnalyticsSummary() {
  // Get total favorites count
  const totalFavorites = await prisma.favorite.count()

  // Get total ratings count
  const totalRatings = await prisma.rating.count()

  // Get total patterns count
  const totalPatterns = await prisma.pattern.count()

  // Get total users count
  const totalUsers = await prisma.user.count()

  // Get total designers count
  const totalDesigners = await prisma.designer.count()

  return {
    totalFavorites,
    totalRatings,
    totalPatterns,
    totalUsers,
    totalDesigners,
  }
}

export default async function AnalyticsPage() {
  const { totalFavorites, totalRatings, totalPatterns, totalUsers, totalDesigners } = await getAnalyticsSummary()

  return (
    <div>
      <h1 className="mb-4">Analytics Dashboard</h1>

      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Total Patterns</h5>
              <div className="d-flex align-items-center">
                <TrendingUp size={24} className="me-2 text-primary" />
                <p className="card-text display-4 mb-0">{totalPatterns}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Total Users</h5>
              <div className="d-flex align-items-center">
                <Users size={24} className="me-2 text-success" />
                <p className="card-text display-4 mb-0">{totalUsers}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Total Designers</h5>
              <div className="d-flex align-items-center">
                <Users size={24} className="me-2 text-info" />
                <p className="card-text display-4 mb-0">{totalDesigners}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
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

      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Favorites Analytics</h5>
              <p className="card-text">
                View detailed analytics about user favorites, including top favorited patterns and user activity.
              </p>
              <Link href="/admin/analytics/favorites" className="btn btn-danger">
                <Heart size={18} className="me-2" />
                View Favorites Analytics
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Ratings Analytics</h5>
              <p className="card-text">
                View detailed analytics about pattern ratings, including top rated patterns and rating distribution.
              </p>
              <Link href="/admin/analytics/ratings" className="btn btn-warning">
                <Star size={18} className="me-2" />
                View Ratings Analytics
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">User Analytics</h5>
              <p className="card-text">
                View detailed analytics about user activity, registrations, and engagement metrics.
              </p>
              <Link href="/admin/analytics/users" className="btn btn-success">
                <Users size={18} className="me-2" />
                View User Analytics
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Search Analytics</h5>
              <p className="card-text">View detailed analytics about search queries, popular terms, and results.</p>
              <Link href="/admin/analytics/search" className="btn btn-primary">
                <Search size={18} className="me-2" />
                View Search Analytics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
