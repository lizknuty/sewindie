import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    // Get all fabric types
    const fabricTypes = await prisma.fabricType.findMany({
      orderBy: { name: "asc" },
    })
    return NextResponse.json(fabricTypes)
  } catch (error) {
    console.error("Error fetching fabric types:", error)
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

    // Create fabric type
    const fabricType = await prisma.fabricType.create({
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, fabricType }, { status: 201 })
  } catch (error) {
    console.error("Error creating fabric type:", error)
    return NextResponse.json({ success: false, error: "Failed to create fabric type" }, { status: 500 })
  }
}
