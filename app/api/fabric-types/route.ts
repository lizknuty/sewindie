import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const fabricTypes = await prisma.fabricType.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(fabricTypes)
  } catch (error) {
    console.error("Error fetching fabric types:", error)
    return NextResponse.json({ error: "Failed to fetch fabric types" }, { status: 500 })
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
    const newFabricType = await prisma.fabricType.create({
      data: { name, description },
    })
    return NextResponse.json(newFabricType, { status: 201 })
  } catch (error) {
    console.error("Error creating fabric type:", error)
    return NextResponse.json({ error: "Failed to create fabric type" }, { status: 500 })
  }
}
