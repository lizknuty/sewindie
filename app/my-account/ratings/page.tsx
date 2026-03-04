import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Star, MessageSquare } from "lucide-react"

export default async function MyRatingsPage() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login")
  }

  const ratings = await prisma.rating.findMany({
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
      <h1 className="text-3xl font-bold mb-6">My Ratings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Pattern Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <MessageSquare className="h-12 w-12 mb-4" />
              <p className="text-lg">You haven't rated any patterns yet.</p>
              <p className="text-sm">Rate patterns to share your thoughts!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {ratings.map((rating) => (
                <Card key={rating.id} className="overflow-hidden">
                  <Link href={`/patterns/${rating.pattern.id}`}>
                    {rating.pattern.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rating.pattern.image || "/placeholder.svg"}
                        alt={rating.pattern.name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                        No Image
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="text-lg font-semibold">{rating.pattern.name}</h3>
                      <p className="text-sm text-gray-500">{rating.pattern.designer.name}</p>
                      <div className="flex items-center mt-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-5 w-5 ${
                              i < rating.value ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                            }`}
                          />
                        ))}
                        <span className="ml-2 text-sm text-gray-600">({rating.value}/5)</span>
                      </div>
                      {rating.comment && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{rating.comment}</p>}
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
