import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ratingId = Number.parseInt(params.id)
    if (isNaN(ratingId)) {
      return NextResponse.json({ error: "Invalid rating ID" }, { status: 400 })
    }

    // Check admin access
    const { authorized, response } = await checkAdminAccess()
    if (!authorized) return response

    const rating = await prisma.rating.findUnique({
      where: {
        id: ratingId,
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

    if (!rating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, rating })
  } catch (error) {
    console.error("Error fetching rating:", error)
    return NextResponse.json({ error: "Failed to fetch rating" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ratingId = Number.parseInt(params.id)
    if (isNaN(ratingId)) {
      return NextResponse.json({ error: "Invalid rating ID" }, { status: 400 })
    }

    // Check admin access
    const { authorized, response } = await checkAdminAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate score
    if (typeof data.score !== "number" || data.score < 1 || data.score > 5) {
      return NextResponse.json({ error: "Valid score (1-5) is required" }, { status: 400 })
    }

    // Check if rating exists
    const existingRating = await prisma.rating.findUnique({
      where: {
        id: ratingId,
      },
    })

    if (!existingRating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 })
    }

    // Update rating
    const rating = await prisma.rating.update({
      where: {
        id: ratingId,
      },
      data: {
        score: data.score,
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
          },
        },
      },
    })

    return NextResponse.json({ success: true, rating })
  } catch (error) {
    console.error("Error updating rating:", error)
    return NextResponse.json({ error: "Failed to update rating" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const ratingId = Number.parseInt(params.id, 10)

  if (isNaN(ratingId)) {
    return NextResponse.json({ error: "Invalid Rating ID" }, { status: 400 })
  }

  try {
    await prisma.rating.delete({
      where: { id: ratingId },
    })
    return NextResponse.json({ message: "Rating deleted successfully" })
  } catch (error) {
    console.error("Error deleting rating:", error)
    return NextResponse.json({ error: "Failed to delete rating" }, { status: 500 })
  }
}
