import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Star } from "lucide-react"

export default async function RatingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div>No user information available</div>
  }

  // Get user's ratings
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    return <div>User not found</div>
  }

  const ratings = await prisma.rating.findMany({
    where: { userId: user.id },
    include: {
      pattern: {
        include: {
          designer: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div>
      <h1 className="mb-4">My Ratings</h1>

      {ratings.length === 0 ? (
        <div className="alert alert-info">You haven't rated any patterns yet.</div>
      ) : (
        <div className="row">
          {ratings.map((rating) => (
            <div key={`${rating.patternId}-${rating.userId}`} className="col-md-4 mb-4">
              <div className="card h-100">
                <Image
                  src={rating.pattern.thumbnail_url || "/placeholder.svg"}
                  alt={rating.pattern.name}
                  width={300}
                  height={300}
                  className="card-img-top"
                />
                <div className="card-body">
                  <h5 className="card-title">{rating.pattern.name}</h5>
                  <p className="card-text">By {rating.pattern.designer.name}</p>
                  <div className="d-flex align-items-center mb-2">
                    {Array.from({ length: rating.score }).map((_, i) => (
                      <Star key={i} size={16} className="text-warning" />
                    ))}
                    <span className="ms-2">{rating.score}/5</span>
                  </div>
                  <p className="card-text">
                    <small className="text-muted">
                      Rated {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                    </small>
                  </p>
                </div>
                <div className="card-footer bg-transparent border-top-0">
                  <Link href={`/patterns/${rating.patternId}`} className="btn btn-primary">
                    View Pattern
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
