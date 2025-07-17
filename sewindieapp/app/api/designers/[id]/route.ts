import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Convert string ID to number
    const designerId = Number.parseInt(params.id, 10)

    if (isNaN(designerId)) {
      return NextResponse.json({ error: "Invalid designer ID" }, { status: 400 })
    }

    const designer = await prisma.designer.findUnique({
      where: {
        id: designerId,
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
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const id = Number.parseInt(params.id, 10)
    const data = await request.json()

    if (!data.name || !data.url) {
      return NextResponse.json({ error: "Name and Website URL are required" }, { status: 400 })
    }

    const updatedDesigner = await prisma.designer.update({
      where: { id },
      data: {
        name: data.name,
        url: data.url,
        logo_url: data.logo_url || null,
        email: data.email || null,
        address: data.address || null,
        facebook: data.facebook || null,
        instagram: data.instagram || null,
        pinterest: data.pinterest || null,
        youtube: data.youtube || null,
      },
    })

    return NextResponse.json(updatedDesigner)
  } catch (error) {
    console.error(`Error updating designer with ID ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to update designer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const id = Number.parseInt(params.id, 10)

    // Before deleting the designer, you might need to handle related patterns.
    // For this example, we assume onDelete: Cascade is set up or patterns are handled manually.
    await prisma.designer.delete({
      where: { id },
    })

    return new NextResponse(null, { status: 204 }) // 204 No Content
  } catch (error) {
    console.error(`Error deleting designer with ID ${params.id}:`, error)
    return NextResponse.json({ error: "Failed to delete designer" }, { status: 500 })
  }
}
