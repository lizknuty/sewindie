import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const fabricTypeId = Number.parseInt(params.id, 10)

    if (isNaN(fabricTypeId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 })
    }

    const fabricType = await prisma.fabricType.findUnique({
      where: {
        id: fabricTypeId,
      },
      include: {
        PatternFabricType: {
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

    if (!fabricType) {
      return NextResponse.json({ success: false, error: "Fabric type not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, fabricType })
  } catch (error) {
    console.error("Error fetching fabric type:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch fabric type" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const fabricTypeId = Number.parseInt(params.id, 10)

    if (isNaN(fabricTypeId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 })
    }

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if fabric type exists
    const existingFabricType = await prisma.fabricType.findUnique({
      where: {
        id: fabricTypeId,
      },
    })

    if (!existingFabricType) {
      return NextResponse.json({ error: "Fabric type not found" }, { status: 404 })
    }

    // Update fabric type
    const fabricType = await prisma.fabricType.update({
      where: {
        id: fabricTypeId,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, fabricType })
  } catch (error) {
    console.error("Error updating fabric type:", error)
    return NextResponse.json({ success: false, error: "Failed to update fabric type" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const fabricTypeId = Number.parseInt(params.id, 10)

    if (isNaN(fabricTypeId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 })
    }

    // Check if fabric type exists and has patterns
    const existingFabricType = await prisma.fabricType.findUnique({
      where: {
        id: fabricTypeId,
      },
      include: {
        PatternFabricType: true,
      },
    })

    if (!existingFabricType) {
      return NextResponse.json({ error: "Fabric type not found" }, { status: 404 })
    }

    // Check if fabric type has patterns
    if (existingFabricType.PatternFabricType.length > 0) {
      return NextResponse.json({ error: "Cannot delete fabric type with associated patterns" }, { status: 400 })
    }

    // Delete fabric type
    await prisma.fabricType.delete({
      where: {
        id: fabricTypeId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting fabric type:", error)
    return NextResponse.json({ success: false, error: "Failed to delete fabric type" }, { status: 500 })
  }
}
