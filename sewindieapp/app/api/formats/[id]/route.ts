import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const format = await prisma.format.findUnique({
      where: {
        id: params.id,
      },
      include: {
        PatternFormat: {
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

    if (!format) {
      return NextResponse.json({ success: false, error: "Format not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, format })
  } catch (error) {
    console.error("Error fetching format:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch format" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if format exists
    const existingFormat = await prisma.format.findUnique({
      where: {
        id: params.id,
      },
    })

    if (!existingFormat) {
      return NextResponse.json({ error: "Format not found" }, { status: 404 })
    }

    // Update format
    const format = await prisma.format.update({
      where: {
        id: params.id,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, format })
  } catch (error) {
    console.error("Error updating format:", error)
    return NextResponse.json({ success: false, error: "Failed to update format" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Check if format exists and has patterns
    const existingFormat = await prisma.format.findUnique({
      where: {
        id: params.id,
      },
      include: {
        PatternFormat: true,
      },
    })

    if (!existingFormat) {
      return NextResponse.json({ error: "Format not found" }, { status: 404 })
    }

    // Check if format has patterns
    if (existingFormat.PatternFormat.length > 0) {
      return NextResponse.json({ error: "Cannot delete format with associated patterns" }, { status: 400 })
    }

    // Delete format
    await prisma.format.delete({
      where: {
        id: params.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting format:", error)
    return NextResponse.json({ success: false, error: "Failed to delete format" }, { status: 500 })
  }
}
