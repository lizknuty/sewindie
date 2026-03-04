import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const designerId = Number.parseInt(params.id, 10)

  if (isNaN(designerId)) {
    return NextResponse.json({ error: "Invalid Designer ID" }, { status: 400 })
  }

  try {
    const designer = await prisma.designer.findUnique({
      where: { id: designerId },
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const designerId = Number.parseInt(params.id, 10)

  if (isNaN(designerId)) {
    return NextResponse.json({ error: "Invalid Designer ID" }, { status: 400 })
  }

  try {
    const { name, description, website_url } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedDesigner = await prisma.designer.update({
      where: { id: designerId },
      data: { name, description, website_url },
    })
    return NextResponse.json(updatedDesigner)
  } catch (error) {
    console.error("Error updating designer:", error)
    return NextResponse.json({ error: "Failed to update designer" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const designerId = Number.parseInt(params.id, 10)

  if (isNaN(designerId)) {
    return NextResponse.json({ error: "Invalid Designer ID" }, { status: 400 })
  }

  try {
    await prisma.designer.delete({
      where: { id: designerId },
    })
    return NextResponse.json({ message: "Designer deleted successfully" })
  } catch (error) {
    console.error("Error deleting designer:", error)
    return NextResponse.json({ error: "Failed to delete designer" }, { status: 500 })
  }
}
