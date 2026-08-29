import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const designerId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(designerId)) {
      return NextResponse.json({ error: "Invalid designer ID" }, { status: 400 })
    }

    const designer = await prisma.designer.findUnique({
      where: {
        id: designerId,
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const designerId = Number.parseInt(resolvedParams.id, 10)
    const data = await request.json()

    if (isNaN(designerId)) {
      return NextResponse.json({ error: "Invalid designer ID" }, { status: 400 })
    }

    if (!data.name || !data.url) {
      return NextResponse.json({ error: "Name and Website URL are required" }, { status: 400 })
    }

    // These columns are VarChar(255) in the database. A value longer than that
    // makes Postgres reject the write ("value too long"), which previously
    // surfaced only as a generic 500. Validate up front with a clear message.
    const maxLen: Record<string, number> = { name: 255, email: 255, address: 255, tagline: 255 }
    for (const [field, limit] of Object.entries(maxLen)) {
      const value = data[field]
      if (typeof value === "string" && value.length > limit) {
        return NextResponse.json(
          { error: `${field[0].toUpperCase()}${field.slice(1)} must be ${limit} characters or fewer (got ${value.length}).` },
          { status: 400 },
        )
      }
    }

    const updatedDesigner = await prisma.designer.update({
      where: { id: designerId },
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
        tagline: data.tagline || null,
        about: data.about || null,
        ...(data.status ? { status: data.status } : {}),
      },
    })

    return NextResponse.json(updatedDesigner)
  } catch (error) {
    const resolvedParams = await params
    console.error(`Error updating designer with ID ${resolvedParams.id}:`, error)

    // Map known Prisma errors to actionable messages instead of a blanket 500,
    // so failures like "value too long" (P2000) or a unique conflict (P2002)
    // are visible to the admin instead of a generic "Failed to update designer".
    const code = (error as { code?: string })?.code
    if (code === "P2000") {
      return NextResponse.json({ error: "One of the fields is too long for the database." }, { status: 400 })
    }
    if (code === "P2002") {
      return NextResponse.json({ error: "A designer with that value already exists." }, { status: 409 })
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "Designer not found." }, { status: 404 })
    }

    const detail = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to update designer", detail }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const designerId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(designerId)) {
      return NextResponse.json({ error: "Invalid designer ID" }, { status: 400 })
    }

    const existingDesigner = await prisma.designer.findUnique({
      where: { id: designerId },
      include: { patterns: { take: 1 } },
    })

    if (!existingDesigner) {
      return NextResponse.json({ error: "Designer not found" }, { status: 404 })
    }

    if (existingDesigner.patterns.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a designer with associated patterns. Please reassign or delete their patterns first." },
        { status: 400 },
      )
    }

    await prisma.designer.delete({
      where: { id: designerId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const resolvedParams = await params
    console.error(`Error deleting designer with ID ${resolvedParams.id}:`, error)
    return NextResponse.json({ error: "Failed to delete designer" }, { status: 500 })
  }
}
