import Link from "next/link"
import prisma from "@/lib/prisma"
import { Users, Scissors, Tag, PodcastIcon as Audience } from "lucide-react"

export default async function AdminDashboard() {
  // Get counts for dashboard
  const [designerCount, patternCount, categoryCount, audienceCount, userCount] = await Promise.all([
    prisma.designer.count(),
    prisma.pattern.count(),
    prisma.category.count(),
    prisma.audience.count(),
    prisma.user.count(),
  ])

  return (
    <div>
      <h1 className="mb-4">Admin Dashboard</h1>

      <div className="row">
        <div className="col-md-6 col-lg-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Users</h5>
              <div className="d-flex align-items-center">
                <Users size={24} className="me-2 text-primary" />
                <p className="card-text display-4 mb-0">{userCount}</p>
              </div>
              <Link href="/admin/users" className="btn btn-primary mt-3">
                Manage Users
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Designers</h5>
              <div className="d-flex align-items-center">
                <Users size={24} className="me-2 text-success" />
                <p className="card-text display-4 mb-0">{designerCount}</p>
              </div>
              <Link href="/admin/designers" className="btn btn-primary mt-3">
                Manage Designers
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Patterns</h5>
              <div className="d-flex align-items-center">
                <Scissors size={24} className="me-2 text-danger" />
                <p className="card-text display-4 mb-0">{patternCount}</p>
              </div>
              <Link href="/admin/patterns" className="btn btn-primary mt-3">
                Manage Patterns
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Categories</h5>
              <div className="d-flex align-items-center">
                <Tag size={24} className="me-2 text-info" />
                <p className="card-text display-4 mb-0">{categoryCount}</p>
              </div>
              <Link href="/admin/categories" className="btn btn-primary mt-3">
                Manage Categories
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-6 col-lg-4 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Audiences</h5>
              <div className="d-flex align-items-center">
                <Audience size={24} className="me-2 text-warning" />
                <p className="card-text display-4 mb-0">{audienceCount}</p>
              </div>
              <Link href="/admin/audiences" className="btn btn-primary mt-3">
                Manage Audiences
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
