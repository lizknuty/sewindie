import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"
import PatternThumbnail from "@/components/PatternThumbnail"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Star } from "lucide-react"

const MAX_SCORE = 5

export default async function RatingsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div className="account-empty">No user information available</div>
  }

  // Get user's ratings
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    return <div className="account-empty">User not found</div>
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
      <header className="account-head">
        <h1 className="account-title">My Ratings</h1>
        <p className="account-subtitle">
          {ratings.length === 0
            ? "Patterns you rate will appear here."
            : `${ratings.length} ${ratings.length === 1 ? "pattern" : "patterns"} rated, newest first.`}
        </p>
      </header>

      {ratings.length === 0 ? (
        <div className="account-empty">
          <p className="account-empty-title">No ratings yet</p>
          <p className="account-empty-text">
            Rate the patterns you&apos;ve sewn to keep track of what worked and help other sewists.
          </p>
          <Link href="/patterns" className="account-btn account-empty-cta">
            Browse patterns
          </Link>
        </div>
      ) : (
        <div className="account-grid">
          {ratings.map((rating: (typeof ratings)[number]) => (
            <Link
              key={`${rating.patternId}-${rating.userId}`}
              href={`/patterns/${rating.patternId}`}
              className="account-item"
            >
              <div className="account-item-media">
                <PatternThumbnail
                  src={rating.pattern.thumbnail_url}
                  alt={rating.pattern.name}
                  fill
                  sizes="(min-width: 992px) 25vw, (min-width: 576px) 50vw, 100vw"
                />
              </div>
              <div className="account-item-body">
                <h2 className="account-item-name">{rating.pattern.name}</h2>
                <p className="account-item-designer">{rating.pattern.designer.name}</p>

                {/* All five stars render, with unearned ones greyed out. Drawing
                    only the earned stars made a 1/5 look like a single-star
                    scale rather than a low score. */}
                <span className="account-stars">
                  <span className="account-star-row" aria-hidden="true">
                    {Array.from({ length: MAX_SCORE }).map((_, i) => (
                      <Star key={i} size={14} className={i < rating.score ? "account-star-on" : undefined} />
                    ))}
                  </span>
                  <span className="account-score">
                    {rating.score}/{MAX_SCORE}
                  </span>
                </span>

                <span className="account-item-meta">
                  Rated {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
