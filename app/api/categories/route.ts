import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
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
    const newCategory = await prisma.category.create({
      data: { name, description },
    })
    return NextResponse.json(newCategory, { status: 201 })
  } catch (error) {
    console.error("Error creating category:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
