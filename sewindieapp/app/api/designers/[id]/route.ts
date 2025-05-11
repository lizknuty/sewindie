import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const designer = await prisma.designer.findUnique({
      where: {
        id: params.id,
      },
      include: {
        patterns: true,
      },
    })

    if (!designer) {
      return NextResponse.json({ error: "Designer not found" }, { status: 404 })
    }

    return NextResponse.json(designer)
  } catch (error) {
    console.error("Error fetching designer:", error)
    return NextResponse.json({ error: "Failed to fetch designer" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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

    // Check if designer exists
    const existingDesigner = await prisma.designer.findUnique({
      where: {
        id: params.id,
      },
    })

    if (!existingDesigner) {
      return NextResponse.json({ error: "Designer not found" }, { status: 404 })
    }

    // Update designer
    const designer = await prisma.designer.update({
      where: {
        id: params.id,
      },
      data: {
        name: data.name,
        logo_url: data.logo_url || null,
        website: data.website || null,
        description: data.description || null,
      },
    })

    return NextResponse.json(designer)
  } catch (error) {
    console.error("Error updating designer:", error)
    return NextResponse.json({ error: "Failed to update designer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if designer exists
    const existingDesigner = await prisma.designer.findUnique({
      where: {
        id: params.id,
      },
      include: {
        patterns: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!existingDesigner) {
      return NextResponse.json({ error: "Designer not found" }, { status: 404 })
    }

    // Check if designer has patterns
    if (existingDesigner.patterns.length > 0) {
      return NextResponse.json({ error: "Cannot delete designer with associated patterns" }, { status: 400 })
    }

    // Delete designer
    await prisma.designer.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting designer:", error)
    return NextResponse.json({ error: "Failed to delete designer" }, { status: 500 })
  }
}
