import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const audienceId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json({ error: "Invalid audience ID" }, { status: 400 })
    }

    const audience = await prisma.audience.findUnique({
      where: {
        id: audienceId,
      },
      include: {
        PatternAudience: {
          include: {
            pattern: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!audience) {
      return NextResponse.json({ success: false, error: "Audience not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, audience })
  } catch (error) {
    console.error("Error fetching audience:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch audience" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const audienceId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json({ error: "Invalid audience ID" }, { status: 400 })
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if audience exists
    const existingAudience = await prisma.audience.findUnique({
      where: {
        id: audienceId,
      },
    })

    if (!existingAudience) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 })
    }

    // Update audience
    const audience = await prisma.audience.update({
      where: {
        id: audienceId,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, audience })
  } catch (error) {
    console.error("Error updating audience:", error)
    return NextResponse.json({ success: false, error: "Failed to update audience" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const audienceId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(audienceId)) {
      return NextResponse.json({ error: "Invalid audience ID" }, { status: 400 })
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if audience exists and has patterns
    const existingAudience = await prisma.audience.findUnique({
      where: {
        id: audienceId,
      },
      include: {
        PatternAudience: true,
      },
    })

    if (!existingAudience) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 })
    }

    // Check if audience has patterns
    if (existingAudience.PatternAudience.length > 0) {
      return NextResponse.json({ error: "Cannot delete audience with associated patterns" }, { status: 400 })
    }

    // Delete audience
    await prisma.audience.delete({
      where: {
        id: audienceId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting audience:", error)
    return NextResponse.json({ success: false, error: "Failed to delete audience" }, { status: 500 })
  }
}
