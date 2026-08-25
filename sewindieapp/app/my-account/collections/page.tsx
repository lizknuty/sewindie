import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"
import CollectionsManager from "./components/CollectionsManager"

export default async function MyCollectionsPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return <div className="account-empty">No user information available</div>
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })

  if (!user) {
    return <div className="account-empty">User not found</div>
  }

  const collections = await prisma.collection.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { patterns: true } },
      patterns: {
        take: 4,
        orderBy: { addedAt: "desc" },
        include: {
          pattern: { select: { id: true, name: true, thumbnail_url: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Flattened here so the client component never has to know about Prisma's
  // nested join/_count shapes.
  const initialCollections = collections.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    visibility: c.visibility as "PUBLIC" | "PRIVATE",
    patternCount: c._count.patterns,
    previews: c.patterns.map((cp) => cp.pattern),
  }))

  return (
    <div>
      <header className="account-head">
        <h1 className="account-title">My Collections</h1>
        <p className="account-subtitle">
          {initialCollections.length === 0
            ? "Group patterns into collections — a capsule wardrobe, a gift list, a someday pile."
            : `${initialCollections.length} ${
                initialCollections.length === 1 ? "collection" : "collections"
              }. Public collections appear on the designer pages of the patterns inside them.`}
        </p>
      </header>

      <CollectionsManager initialCollections={initialCollections} />
    </div>
  )
}
