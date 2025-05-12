import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

// Define types to match Prisma schema
type PatternWithRatings = {
  id: number
  name: string
  designer: {
    id: number
    name: string
  } | null
  ratings: {
    score: number
  }[]
  _count: {
    ratings: number
  }
}

type RatingWithRelations = {
  id: number
  score: number
  createdAt: Date
  user: {
    id: number
    name: string
    email: string
  }
  pattern: {
    id: number
    name: string
    designer: {
      id: number
      name: string
    } | null
  }
}

type RatingDistribution = {
  score: number
  _count: number
}

type UserWithCount = {
  user:
    | {
        id: number
        name: string
        email: string
      }
    | undefined
  ratingCount: number
}

export async function GET() {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get top rated patterns
    const topRatedPatterns = (await prisma.pattern.findMany({
      where: {
        ratings: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        designer: {
          select: {
            id: true,
            name: true,
          },
        },
        ratings: {
          select: {
            score: true,
          },
        },
        _count: {
          select: {
            ratings: true,
          },
        },
      },
      orderBy: [
        {
          ratings: {
            _count: "desc",
          },
        },
      ],
      take: 10,
    })) as unknown as PatternWithRatings[]

    // Calculate average ratings
    const patternsWithAvgRating = topRatedPatterns.map((pattern) => {
      const totalScore = pattern.ratings.reduce((sum: number, rating: { score: number }) => sum + rating.score, 0)
      const avgRating = pattern.ratings.length > 0 ? totalScore / pattern.ratings.length : 0

      return {
        id: pattern.id,
        name: pattern.name,
        designer: pattern.designer,
        averageRating: Number.parseFloat(avgRating.toFixed(2)),
        ratingCount: pattern._count.ratings,
      }
    })

    // Get recent ratings activity
    const recentRatings = (await prisma.rating.findMany({
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pattern: {
          select: {
            id: true,
            name: true,
            designer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })) as unknown as RatingWithRelations[]

    // Get total ratings count
    const totalRatings = await prisma.rating.count()

    // Get rating distribution
    const ratingDistribution = (await prisma.rating.groupBy({
      by: ["score"],
      _count: true,
      orderBy: {
        score: "desc",
      },
    })) as unknown as RatingDistribution[]

    // Format distribution for easier consumption
    const distribution: Record<string, number> = {
      "5": 0,
      "4": 0,
      "3": 0,
      "2": 0,
      "1": 0,
    }

    ratingDistribution.forEach((item) => {
      // Convert number to string for indexing
      const scoreKey = item.score.toString() as keyof typeof distribution
      distribution[scoreKey] = item._count
    })

    // Get users with most ratings
    const topRaters = await prisma.rating.groupBy({
      by: ["userId"],
      _count: {
        userId: true,
      },
      orderBy: {
        _count: {
          userId: "desc",
        },
      },
      take: 10,
    })

    // Get users details
    const userIds = topRaters.map((u) => u.userId)
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Combine data
    const topRatingUsers = topRaters.map((tu) => {
      const user = users.find((u) => u.id === tu.userId)
      return {
        user,
        ratingCount: tu._count.userId,
      }
    }) as UserWithCount[]

    return NextResponse.json({
      success: true,
      topRatedPatterns: patternsWithAvgRating,
      recentRatings,
      totalRatings,
      ratingDistribution: distribution,
      topRatingUsers,
    })
  } catch (error) {
    console.error("Error fetching ratings analytics:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ratings analytics" }, { status: 500 })
  }
}
