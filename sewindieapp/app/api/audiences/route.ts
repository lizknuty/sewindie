import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    // Keep the existing implementation for GET
    const audiences = await prisma.audience.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(audiences)
  } catch (error) {
    console.error("Error fetching audiences:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Create audience
    const audience = await prisma.audience.create({
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, audience }, { status: 201 })
  } catch (error) {
    console.error("Error creating audience:", error)
    return NextResponse.json({ success: false, error: "Failed to create audience" }, { status: 500 })
  }
}
