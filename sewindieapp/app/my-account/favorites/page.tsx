import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div>No user information available</div>
  }

  // Get user's favorites
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    return <div>User not found</div>
  }

  const favorites = await prisma.favorite.findMany({
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
      <h1 className="mb-4">My Favorites</h1>

      {favorites.length === 0 ? (
        <div className="alert alert-info">You haven't favorited any patterns yet.</div>
      ) : (
        <div className="row">
          {favorites.map((favorite) => (
            <div key={`${favorite.patternId}-${favorite.userId}`} className="col-md-4 mb-4">
              <div className="card h-100">
                <Image
                  src={favorite.pattern.thumbnail_url || "/placeholder.svg"}
                  alt={favorite.pattern.name}
                  width={300}
                  height={300}
                  className="card-img-top"
                />
                <div className="card-body">
                  <h5 className="card-title">{favorite.pattern.name}</h5>
                  <p className="card-text">By {favorite.pattern.designer.name}</p>
                  <p className="card-text">
                    <small className="text-muted">
                      Favorited {formatDistanceToNow(new Date(favorite.createdAt), { addSuffix: true })}
                    </small>
                  </p>
                </div>
                <div className="card-footer bg-transparent border-top-0">
                  <Link href={`/patterns/${favorite.patternId}`} className="btn btn-primary">
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
