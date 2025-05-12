import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const attributeId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(attributeId)) {
      return NextResponse.json({ error: "Invalid attribute ID" }, { status: 400 })
    }

    const attribute = await prisma.attribute.findUnique({
      where: {
        id: attributeId,
      },
      include: {
        PatternAttribute: {
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

    if (!attribute) {
      return NextResponse.json({ success: false, error: "Attribute not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, attribute })
  } catch (error) {
    console.error("Error fetching attribute:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch attribute" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const attributeId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(attributeId)) {
      return NextResponse.json({ error: "Invalid attribute ID" }, { status: 400 })
    }

    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if attribute exists
    const existingAttribute = await prisma.attribute.findUnique({
      where: {
        id: attributeId,
      },
    })

    if (!existingAttribute) {
      return NextResponse.json({ error: "Attribute not found" }, { status: 404 })
    }

    // Update attribute
    const attribute = await prisma.attribute.update({
      where: {
        id: attributeId,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, attribute })
  } catch (error) {
    console.error("Error updating attribute:", error)
    return NextResponse.json({ success: false, error: "Failed to update attribute" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const attributeId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(attributeId)) {
      return NextResponse.json({ error: "Invalid attribute ID" }, { status: 400 })
    }

    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Check if attribute exists and has patterns
    const existingAttribute = await prisma.attribute.findUnique({
      where: {
        id: attributeId,
      },
      include: {
        PatternAttribute: true,
      },
    })

    if (!existingAttribute) {
      return NextResponse.json({ error: "Attribute not found" }, { status: 404 })
    }

    // Check if attribute has patterns
    if (existingAttribute.PatternAttribute.length > 0) {
      return NextResponse.json({ error: "Cannot delete attribute with associated patterns" }, { status: 400 })
    }

    // Delete attribute
    await prisma.attribute.delete({
      where: {
        id: attributeId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting attribute:", error)
    return NextResponse.json({ success: false, error: "Failed to delete attribute" }, { status: 500 })
  }
}
