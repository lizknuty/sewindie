import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const suggestedFabrics = await prisma.suggestedFabric.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(suggestedFabrics)
  } catch (error) {
    console.error("Error fetching suggested fabrics:", error)
    return NextResponse.json({ error: "Failed to fetch suggested fabrics" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    const newSuggestedFabric = await prisma.suggestedFabric.create({
      data: { name, description },
    })
    return NextResponse.json(newSuggestedFabric, { status: 201 })
  } catch (error) {
    console.error("Error creating suggested fabric:", error)
    return NextResponse.json({ error: "Failed to create suggested fabric" }, { status: 500 })
  }
}
