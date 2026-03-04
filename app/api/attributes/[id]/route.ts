import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const attributeId = Number.parseInt(params.id, 10)

  if (isNaN(attributeId)) {
    return NextResponse.json({ error: "Invalid Attribute ID" }, { status: 400 })
  }

  try {
    const attribute = await prisma.attribute.findUnique({
      where: { id: attributeId },
    })

    if (!attribute) {
      return NextResponse.json({ error: "Attribute not found" }, { status: 404 })
    }

    return NextResponse.json(attribute)
  } catch (error) {
    console.error("Error fetching attribute:", error)
    return NextResponse.json({ error: "Failed to fetch attribute" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const attributeId = Number.parseInt(params.id, 10)

  if (isNaN(attributeId)) {
    return NextResponse.json({ error: "Invalid Attribute ID" }, { status: 400 })
  }

  try {
    const { label } = await request.json()
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 })
    }

    const updatedAttribute = await prisma.attribute.update({
      where: { id: attributeId },
      data: { label },
    })
    return NextResponse.json(updatedAttribute)
  } catch (error) {
    console.error("Error updating attribute:", error)
    return NextResponse.json({ error: "Failed to update attribute" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const attributeId = Number.parseInt(params.id, 10)

  if (isNaN(attributeId)) {
    return NextResponse.json({ error: "Invalid Attribute ID" }, { status: 400 })
  }

  try {
    await prisma.attribute.delete({
      where: { id: attributeId },
    })
    return NextResponse.json({ message: "Attribute deleted successfully" })
  } catch (error) {
    console.error("Error deleting attribute:", error)
    return NextResponse.json({ error: "Failed to delete attribute" }, { status: 500 })
  }
}
