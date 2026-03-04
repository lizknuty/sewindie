import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const audienceId = Number.parseInt(params.id, 10)

  if (isNaN(audienceId)) {
    return NextResponse.json({ error: "Invalid Audience ID" }, { status: 400 })
  }

  try {
    const audience = await prisma.audience.findUnique({
      where: { id: audienceId },
    })

    if (!audience) {
      return NextResponse.json({ error: "Audience not found" }, { status: 404 })
    }

    return NextResponse.json(audience)
  } catch (error) {
    console.error("Error fetching audience:", error)
    return NextResponse.json({ error: "Failed to fetch audience" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const audienceId = Number.parseInt(params.id, 10)

  if (isNaN(audienceId)) {
    return NextResponse.json({ error: "Invalid Audience ID" }, { status: 400 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedAudience = await prisma.audience.update({
      where: { id: audienceId },
      data: { name, description },
    })
    return NextResponse.json(updatedAudience)
  } catch (error) {
    console.error("Error updating audience:", error)
    return NextResponse.json({ error: "Failed to update audience" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const audienceId = Number.parseInt(params.id, 10)

  if (isNaN(audienceId)) {
    return NextResponse.json({ error: "Invalid Audience ID" }, { status: 400 })
  }

  try {
    await prisma.audience.delete({
      where: { id: audienceId },
    })
    return NextResponse.json({ message: "Audience deleted successfully" })
  } catch (error) {
    console.error("Error deleting audience:", error)
    return NextResponse.json({ error: "Failed to delete audience" }, { status: 500 })
  }
}
