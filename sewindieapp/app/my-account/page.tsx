import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"
import { formatDistanceToNow } from "date-fns"

export default async function MyAccountPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div>No user information available</div>
  }

  // Get user details from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: {
        select: {
          favorites: true,
          ratings: true,
        },
      },
    },
  })

  if (!user) {
    return <div>User not found</div>
  }

  return (
    <div>
      <h1 className="mb-4">My Profile</h1>

      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Account Information</h5>
          <div className="row mb-3">
            <div className="col-md-3 fw-bold">Name:</div>
            <div className="col-md-9">{user.name}</div>
          </div>
          <div className="row mb-3">
            <div className="col-md-3 fw-bold">Email:</div>
            <div className="col-md-9">{user.email}</div>
          </div>
          <div className="row mb-3">
            <div className="col-md-3 fw-bold">Member Since:</div>
            <div className="col-md-9">{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Favorites</h5>
              <p className="display-4 mb-0">{user._count.favorites}</p>
              <a href="/my-account/favorites" className="btn btn-outline-primary mt-3">
                View All Favorites
              </a>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-body">
              <h5 className="card-title">Ratings</h5>
              <p className="display-4 mb-0">{user._count.ratings}</p>
              <a href="/my-account/ratings" className="btn btn-outline-primary mt-3">
                View All Ratings
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
