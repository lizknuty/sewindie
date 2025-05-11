import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get top favorited patterns
    const topPatterns = await prisma.favorite.groupBy({
      by: ["patternId"],
      _count: {
        patternId: true,
      },
      orderBy: {
        _count: {
          patternId: "desc",
        },
      },
      take: 10,
    })

    // Get patterns details
    const patternIds = topPatterns.map((p) => p.patternId)
    const patterns = await prisma.pattern.findMany({
      where: {
        id: {
          in: patternIds,
        },
      },
      include: {
        designer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Combine data
    const topFavoritedPatterns = topPatterns.map((tp) => {
      const pattern = patterns.find((p) => p.id === tp.patternId)
      return {
        pattern,
        favoriteCount: tp._count.patternId,
      }
    })

    // Get recent favorites activity
    const recentFavorites = await prisma.favorite.findMany({
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
    })

    // Get total favorites count
    const totalFavorites = await prisma.favorite.count()

    // Get users with most favorites
    const topUsers = await prisma.favorite.groupBy({
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
    const userIds = topUsers.map((u) => u.userId)
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
    const topFavoritingUsers = topUsers.map((tu) => {
      const user = users.find((u) => u.id === tu.userId)
      return {
        user,
        favoriteCount: tu._count.userId,
      }
    })

    return NextResponse.json({
      success: true,
      topFavoritedPatterns,
      recentFavorites,
      totalFavorites,
      topFavoritingUsers,
    })
  } catch (error) {
    console.error("Error fetching favorites analytics:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch favorites analytics" }, { status: 500 })
  }
}
