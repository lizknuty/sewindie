import Link from "next/link"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { ChevronLeft, Globe, Lock } from "lucide-react"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"
import PatternCard from "@/components/PatternCard"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params
  const collectionId = Number.parseInt(id, 10)
  if (Number.isNaN(collectionId)) {
    notFound()
  }

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      user: { select: { id: true, name: true, username: true, email: true } },
      patterns: {
        orderBy: { addedAt: "desc" },
        include: {
          pattern: {
            include: {
              designer: { select: { id: true, name: true } },
              PatternCategory: { include: { category: true } },
            },
          },
        },
      },
    },
  })

  if (!collection) {
    notFound()
  }

  // A private collection is visible only to its owner. Everyone else gets a
  // 404 rather than a 403, so the page never confirms that it exists.
  const session = await getServerSession(authOptions)
  const isOwner = Boolean(
    session?.user?.email && session.user.email === collection.user.email,
  )

  if (collection.visibility === "PRIVATE" && !isOwner) {
    notFound()
  }

  const ownerName = collection.user.name || collection.user.username
  const count = collection.patterns.length

  return (
    <div className="designer-page">
      <section className="dhero">
        <div className="dhero-shell">
          <Link href={isOwner ? "/my-account/collections" : "/patterns"} className="dhero-back">
            <ChevronLeft size={16} aria-hidden="true" />
            {isOwner ? "Back to my collections" : "Browse patterns"}
          </Link>

          <div className="dhero-main">
            <div className="dhero-copy">
              <h1 className="dhero-name">{collection.name}</h1>
              <p className="cdetail-byline">
                A collection by {ownerName}
                {isOwner && (
                  <span className="ccard-vis cdetail-vis">
                    {collection.visibility === "PUBLIC" ? (
                      <>
                        <Globe size={13} aria-hidden="true" />
                        Public
                      </>
                    ) : (
                      <>
                        <Lock size={13} aria-hidden="true" />
                        Private
                      </>
                    )}
                  </span>
                )}
              </p>
              {collection.description && (
                <p className="dhero-tagline">{collection.description}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="designer-shell">
        <div className="dpanel-head cdetail-head">
          <h2 className="dpanel-title">
            {count.toLocaleString()} {count === 1 ? "pattern" : "patterns"}
          </h2>
        </div>

        {count === 0 ? (
          <div className="dempty">
            <p className="dempty-title">Nothing here yet</p>
            <p className="dempty-text">
              {isOwner
                ? "Open any pattern and use “Add to collection” to start filling this one."
                : "This collection does not have any patterns in it yet."}
            </p>
            {isOwner && (
              <Link href="/patterns" className="account-btn account-empty-cta">
                Browse patterns
              </Link>
            )}
          </div>
        ) : (
          <div className="pcard-grid">
            {collection.patterns.map((cp) => (
              <PatternCard
                key={cp.pattern.id}
                id={cp.pattern.id}
                name={cp.pattern.name}
                thumbnail_url={cp.pattern.thumbnail_url}
                designer={cp.pattern.designer}
                patternCategories={cp.pattern.PatternCategory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
