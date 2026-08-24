import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"
import PatternThumbnail from "@/components/PatternThumbnail"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div className="account-empty">No user information available</div>
  }

  // Get user's favorites
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    return <div className="account-empty">User not found</div>
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
      <header className="account-head">
        <h1 className="account-title">My Favorites</h1>
        <p className="account-subtitle">
          {favorites.length === 0
            ? "Patterns you save will appear here."
            : `${favorites.length} ${favorites.length === 1 ? "pattern" : "patterns"} saved, newest first.`}
        </p>
      </header>

      {favorites.length === 0 ? (
        <div className="account-empty">
          <p className="account-empty-title">No favorites yet</p>
          <p className="account-empty-text">
            Browse the pattern library and use the heart on any pattern to save it here for later.
          </p>
          <Link href="/patterns" className="account-btn account-empty-cta">
            Browse patterns
          </Link>
        </div>
      ) : (
        <div className="account-grid">
          {favorites.map((favorite: (typeof favorites)[number]) => (
            /* The card itself is the link, so the whole tile is the target
               instead of a small button inside it. */
            <Link
              key={`${favorite.patternId}-${favorite.userId}`}
              href={`/patterns/${favorite.patternId}`}
              className="account-item"
            >
              <div className="account-item-media">
                <PatternThumbnail
                  src={favorite.pattern.thumbnail_url}
                  alt={favorite.pattern.name}
                  fill
                  sizes="(min-width: 992px) 25vw, (min-width: 576px) 50vw, 100vw"
                />
              </div>
              <div className="account-item-body">
                <h2 className="account-item-name">{favorite.pattern.name}</h2>
                <p className="account-item-designer">{favorite.pattern.designer.name}</p>
                <span className="account-item-meta">
                  Saved {formatDistanceToNow(new Date(favorite.createdAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
