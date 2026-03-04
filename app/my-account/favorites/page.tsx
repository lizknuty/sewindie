import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { HeartCrack } from "lucide-react"

export default async function MyFavoritesPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      pattern: {
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              name: true,
            },
          },
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Favorite Patterns</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Favorites</CardTitle>
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <HeartCrack className="h-12 w-12 mb-4" />
              <p className="text-lg">You haven't favorited any patterns yet.</p>
              <p className="text-sm">Browse patterns to add them to your favorites!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {favorites.map((fav) => (
                <Card key={fav.id} className="overflow-hidden">
                  <Link href={`/patterns/${fav.pattern.id}`}>
                    {fav.pattern.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fav.pattern.image || "/placeholder.svg"}
                        alt={fav.pattern.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                        No Image
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="text-lg font-semibold">{fav.pattern.name}</h3>
                      <p className="text-sm text-gray-500">{fav.pattern.designer.name}</p>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
