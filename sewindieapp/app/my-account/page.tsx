import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"

export default async function MyAccountPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div className="account-empty">No user information available</div>
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
    return <div className="account-empty">User not found</div>
  }

  const joined = new Date(user.createdAt)

  return (
    <div>
      <header className="account-head">
        <h1 className="account-title">My Profile</h1>
        <p className="account-subtitle">Your account details and activity on SewIndie.</p>
      </header>

      <section className="account-card">
        <h2 className="account-card-title">Account Information</h2>
        <dl className="account-facts">
          <div>
            <dt className="account-fact-label">Name</dt>
            <dd className="account-fact-value">{user.name || "Not set"}</dd>
          </div>
          <div>
            <dt className="account-fact-label">Email</dt>
            <dd className="account-fact-value">{user.email}</dd>
          </div>
          <div>
            <dt className="account-fact-label">Member Since</dt>
            {/* The absolute date leads, with the relative phrasing after it:
                "about 1 year ago" alone doesn't tell you when you joined. */}
            <dd className="account-fact-value">
              {format(joined, "d MMMM yyyy")}
              <span className="account-item-meta"> ({formatDistanceToNow(joined, { addSuffix: true })})</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="account-stat-row">
        <Link href="/my-account/favorites" className="account-stat">
          <span className="account-stat-value">{user._count.favorites}</span>
          <span className="account-stat-label">
            {user._count.favorites === 1 ? "Saved pattern" : "Saved patterns"}
          </span>
          <span className="account-stat-link">View favorites</span>
        </Link>

        <Link href="/my-account/ratings" className="account-stat">
          <span className="account-stat-value">{user._count.ratings}</span>
          <span className="account-stat-label">{user._count.ratings === 1 ? "Rating" : "Ratings"}</span>
          <span className="account-stat-link">View ratings</span>
        </Link>
      </div>
    </div>
  )
}
