import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const favoriteCounts = await prisma.favorite.groupBy({
      by: ["patternId"],
      _count: {
        patternId: true,
      },
      orderBy: {
        _count: {
          patternId: "desc",
        },
      },
      take: 10, // Get top 10 most favorited patterns
    })

    const patterns = await prisma.pattern.findMany({
      where: {
        id: {
          in: favoriteCounts.map((f) => f.patternId),
        },
      },
      select: {
        id: true,
        name: true,
        designer: {
          select: {
            name: true,
          },
        },
      },
    })

    const result = favoriteCounts.map((fav) => {
      const pattern = patterns.find((p) => p.id === fav.patternId)
      return {
        patternId: fav.patternId,
        patternName: pattern?.name || "Unknown Pattern",
        designerName: pattern?.designer?.name || "Unknown Designer",
        count: fav._count.patternId,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching favorite analytics:", error)
    return NextResponse.json({ error: "Failed to fetch favorite analytics" }, { status: 500 })
  }
}
