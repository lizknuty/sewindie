import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const suggestedFabricId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(suggestedFabricId)) {
      return NextResponse.json({ error: "Invalid suggested fabric ID" }, { status: 400 })
    }

    const suggestedFabric = await prisma.suggestedFabric.findUnique({
      where: {
        id: suggestedFabricId,
      },
      include: {
        PatternSuggestedFabric: {
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

    if (!suggestedFabric) {
      return NextResponse.json({ success: false, error: "Suggested fabric not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, suggestedFabric })
  } catch (error) {
    console.error("Error fetching suggested fabric:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch suggested fabric" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const suggestedFabricId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(suggestedFabricId)) {
      return NextResponse.json({ error: "Invalid suggested fabric ID" }, { status: 400 })
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

    // Check if suggested fabric exists
    const existingSuggestedFabric = await prisma.suggestedFabric.findUnique({
      where: {
        id: suggestedFabricId,
      },
    })

    if (!existingSuggestedFabric) {
      return NextResponse.json({ error: "Suggested fabric not found" }, { status: 404 })
    }

    // Update suggested fabric
    const suggestedFabric = await prisma.suggestedFabric.update({
      where: {
        id: suggestedFabricId,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, suggestedFabric })
  } catch (error) {
    console.error("Error updating suggested fabric:", error)
    return NextResponse.json({ success: false, error: "Failed to update suggested fabric" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const suggestedFabricId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(suggestedFabricId)) {
      return NextResponse.json({ error: "Invalid suggested fabric ID" }, { status: 400 })
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if suggested fabric exists and has patterns
    const existingSuggestedFabric = await prisma.suggestedFabric.findUnique({
      where: {
        id: suggestedFabricId,
      },
      include: {
        PatternSuggestedFabric: true,
      },
    })

    if (!existingSuggestedFabric) {
      return NextResponse.json({ error: "Suggested fabric not found" }, { status: 404 })
    }

    // Check if suggested fabric has patterns
    if (existingSuggestedFabric.PatternSuggestedFabric.length > 0) {
      return NextResponse.json({ error: "Cannot delete suggested fabric with associated patterns" }, { status: 400 })
    }

    // Delete suggested fabric
    await prisma.suggestedFabric.delete({
      where: {
        id: suggestedFabricId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting suggested fabric:", error)
    return NextResponse.json({ success: false, error: "Failed to delete suggested fabric" }, { status: 500 })
  }
}
