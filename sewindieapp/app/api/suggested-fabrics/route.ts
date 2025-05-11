import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const suggestedFabrics = await prisma.suggestedFabric.findMany({
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json({ success: true, suggestedFabrics })
  } catch (error) {
    console.error("Error fetching suggested fabrics:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch suggested fabrics" }, { status: 500 })
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

    // Create suggested fabric
    const suggestedFabric = await prisma.suggestedFabric.create({
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, suggestedFabric }, { status: 201 })
  } catch (error) {
    console.error("Error creating suggested fabric:", error)
    return NextResponse.json({ success: false, error: "Failed to create suggested fabric" }, { status: 500 })
  }
}
