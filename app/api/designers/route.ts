import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const designers = await prisma.designer.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(designers)
  } catch (error) {
    console.error("Error fetching designers:", error)
    return NextResponse.json({ error: "Failed to fetch designers" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const { name, description, website_url } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    const newDesigner = await prisma.designer.create({
      data: { name, description, website_url },
    })
    return NextResponse.json(newDesigner, { status: 201 })
  } catch (error) {
    console.error("Error creating designer:", error)
    return NextResponse.json({ error: "Failed to create designer" }, { status: 500 })
  }
}
