import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const attributes = await prisma.attribute.findMany({
      orderBy: {
        label: "asc",
      },
    })
    return NextResponse.json(attributes)
  } catch (error) {
    console.error("Error fetching attributes:", error)
    return NextResponse.json({ error: "Failed to fetch attributes" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const { label } = await request.json()
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 })
    }
    const newAttribute = await prisma.attribute.create({
      data: { label },
    })
    return NextResponse.json(newAttribute, { status: 201 })
  } catch (error) {
    console.error("Error creating attribute:", error)
    return NextResponse.json({ error: "Failed to create attribute" }, { status: 500 })
  }
}
