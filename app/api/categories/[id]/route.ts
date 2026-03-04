import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const categoryId = Number.parseInt(params.id, 10)

  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid Category ID" }, { status: 400 })
  }

  try {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error("Error fetching category:", error)
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const categoryId = Number.parseInt(params.id, 10)

  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid Category ID" }, { status: 400 })
  }

  try {
    const { name, description } = await request.json()
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: { name, description },
    })
    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { authorized, response } = await checkAdminAccess()
  if (!authorized) {
    return response
  }

  const categoryId = Number.parseInt(params.id, 10)

  if (isNaN(categoryId)) {
    return NextResponse.json({ error: "Invalid Category ID" }, { status: 400 })
  }

  try {
    await prisma.category.delete({
      where: { id: categoryId },
    })
    return NextResponse.json({ message: "Category deleted successfully" })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
