import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const patternId = searchParams.get("patternId")
    const userId = searchParams.get("userId")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    if (patternId) {
      where.patternId = Number.parseInt(patternId)
    }
    if (userId) {
      where.userId = Number.parseInt(userId)
    }

    // Get ratings
    const [ratings, totalCount] = await Promise.all([
      prisma.rating.findMany({
        where,
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
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.rating.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      ratings,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching ratings:", error)
    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 })
  }
}
