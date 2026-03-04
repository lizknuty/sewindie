import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const suggestedFabricId = Number.parseInt(params.id, 10)

  if (isNaN(suggestedFabricId)) {
    return NextResponse.json({ error: "Invalid Suggested Fabric ID" }, { status: 400 })
  }

  try {
    const suggestedFabric = await prisma.suggestedFabric.findUnique({
      where: { id: suggestedFabricId },
    })

    if (!suggestedFabric) {
      return NextResponse.json({ error: "Suggested Fabric not found" }, { status: 404 })
    }

    return NextResponse.json(suggestedFabric)
  } catch (error) {
    console.error("Error fetching suggested fabric:", error)
    return NextResponse.json({ error: "Failed to fetch suggested fabric" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const suggestedFabricId = Number.parseInt(params.id, 10)

  if (isNaN(suggestedFabricId)) {
    return NextResponse.json({ error: "Invalid Suggested Fabric ID" }, { status: 400 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedSuggestedFabric = await prisma.suggestedFabric.update({
      where: { id: suggestedFabricId },
      data: { name, description },
    })
    return NextResponse.json(updatedSuggestedFabric)
  } catch (error) {
    console.error("Error updating suggested fabric:", error)
    return NextResponse.json({ error: "Failed to update suggested fabric" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const suggestedFabricId = Number.parseInt(params.id, 10)

  if (isNaN(suggestedFabricId)) {
    return NextResponse.json({ error: "Invalid Suggested Fabric ID" }, { status: 400 })
  }

  try {
    await prisma.suggestedFabric.delete({
      where: { id: suggestedFabricId },
    })
    return NextResponse.json({ message: "Suggested Fabric deleted successfully" })
  } catch (error) {
    console.error("Error deleting suggested fabric:", error)
    return NextResponse.json({ error: "Failed to delete suggested fabric" }, { status: 500 })
  }
}
