import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const formatId = Number.parseInt(params.id, 10)

  if (isNaN(formatId)) {
    return NextResponse.json({ error: "Invalid Format ID" }, { status: 400 })
  }

  try {
    const format = await prisma.format.findUnique({
      where: { id: formatId },
    })

    if (!format) {
      return NextResponse.json({ error: "Format not found" }, { status: 404 })
    }

    return NextResponse.json(format)
  } catch (error) {
    console.error("Error fetching format:", error)
    return NextResponse.json({ error: "Failed to fetch format" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const formatId = Number.parseInt(params.id, 10)

  if (isNaN(formatId)) {
    return NextResponse.json({ error: "Invalid Format ID" }, { status: 400 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedFormat = await prisma.format.update({
      where: { id: formatId },
      data: { name, description },
    })
    return NextResponse.json(updatedFormat)
  } catch (error) {
    console.error("Error updating format:", error)
    return NextResponse.json({ error: "Failed to update format" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const formatId = Number.parseInt(params.id, 10)

  if (isNaN(formatId)) {
    return NextResponse.json({ error: "Invalid Format ID" }, { status: 400 })
  }

  try {
    await prisma.format.delete({
      where: { id: formatId },
    })
    return NextResponse.json({ message: "Format deleted successfully" })
  } catch (error) {
    console.error("Error deleting format:", error)
    return NextResponse.json({ error: "Failed to delete format" }, { status: 500 })
  }
}
