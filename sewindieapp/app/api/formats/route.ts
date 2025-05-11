import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    // Keep the existing implementation for GET
    const formats = await prisma.format.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    return NextResponse.json(formats)
  } catch (error) {
    console.error("Error fetching formats:", error)
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

    // Create format
    const format = await prisma.format.create({
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, format }, { status: 201 })
  } catch (error) {
    console.error("Error creating format:", error)
    return NextResponse.json({ success: false, error: "Failed to create format" }, { status: 500 })
  }
}
