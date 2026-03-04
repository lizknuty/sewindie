import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const fabricTypeId = Number.parseInt(params.id, 10)

  if (isNaN(fabricTypeId)) {
    return NextResponse.json({ error: "Invalid Fabric Type ID" }, { status: 400 })
  }

  try {
    const fabricType = await prisma.fabricType.findUnique({
      where: { id: fabricTypeId },
    })

    if (!fabricType) {
      return NextResponse.json({ error: "Fabric Type not found" }, { status: 404 })
    }

    return NextResponse.json(fabricType)
  } catch (error) {
    console.error("Error fetching fabric type:", error)
    return NextResponse.json({ error: "Failed to fetch fabric type" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const fabricTypeId = Number.parseInt(params.id, 10)

  if (isNaN(fabricTypeId)) {
    return NextResponse.json({ error: "Invalid Fabric Type ID" }, { status: 400 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedFabricType = await prisma.fabricType.update({
      where: { id: fabricTypeId },
      data: { name, description },
    })
    return NextResponse.json(updatedFabricType)
  } catch (error) {
    console.error("Error updating fabric type:", error)
    return NextResponse.json({ error: "Failed to update fabric type" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const fabricTypeId = Number.parseInt(params.id, 10)

  if (isNaN(fabricTypeId)) {
    return NextResponse.json({ error: "Invalid Fabric Type ID" }, { status: 400 })
  }

  try {
    await prisma.fabricType.delete({
      where: { id: fabricTypeId },
    })
    return NextResponse.json({ message: "Fabric Type deleted successfully" })
  } catch (error) {
    console.error("Error deleting fabric type:", error)
    return NextResponse.json({ error: "Failed to delete fabric type" }, { status: 500 })
  }
}
