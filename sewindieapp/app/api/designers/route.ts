import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    // Keep the existing implementation for GET
    const designers = await prisma.designer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })
    return NextResponse.json(designers)
  } catch (error) {
    console.error("Error fetching designers:", error)
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

    // Create designer
    const designer = await prisma.designer.create({
      data: {
        name: data.name,
        logo_url: data.logo_url || null,
        url: data.website || null, // Changed website to url to match schema
        // Removed description field as it doesn't exist in the schema
      },
    })

    return NextResponse.json(designer, { status: 201 })
  } catch (error) {
    console.error("Error creating designer:", error)
    return NextResponse.json({ error: "Failed to create designer" }, { status: 500 })
  }
}
