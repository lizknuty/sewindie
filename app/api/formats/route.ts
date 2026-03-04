import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const formats = await prisma.format.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(formats)
  } catch (error) {
    console.error("Error fetching formats:", error)
    return NextResponse.json({ error: "Failed to fetch formats" }, { status: 500 })
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
    const newFormat = await prisma.format.create({
      data: { name, description },
    })
    return NextResponse.json(newFormat, { status: 201 })
  } catch (error) {
    console.error("Error creating format:", error)
    return NextResponse.json({ error: "Failed to create format" }, { status: 500 })
  }
}
