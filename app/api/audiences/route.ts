import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const audiences = await prisma.audience.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(audiences)
  } catch (error) {
    console.error("Error fetching audiences:", error)
    return NextResponse.json({ error: "Failed to fetch audiences" }, { status: 500 })
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
    const newAudience = await prisma.audience.create({
      data: { name, description },
    })
    return NextResponse.json(newAudience, { status: 201 })
  } catch (error) {
    console.error("Error creating audience:", error)
    return NextResponse.json({ error: "Failed to create audience" }, { status: 500 })
  }
}
