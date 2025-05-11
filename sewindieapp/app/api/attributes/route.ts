import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    // Keep the existing implementation for GET
    const attributes = await prisma.attribute.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    return NextResponse.json(attributes)
  } catch (error) {
    console.error("Error fetching attributes:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Create attribute
    const attribute = await prisma.attribute.create({
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, attribute }, { status: 201 })
  } catch (error) {
    console.error("Error creating attribute:", error)
    return NextResponse.json({ success: false, error: "Failed to create attribute" }, { status: 500 })
  }
}
