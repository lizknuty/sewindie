import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const categoryId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 })
    }

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      include: {
        PatternCategory: {
          include: {
            pattern: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!category) {
      return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error("Error fetching category:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch category" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const categoryId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 })
    }

    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    })

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Update category
    const category = await prisma.category.update({
      where: {
        id: categoryId,
      },
      data: {
        name: data.name,
      },
    })

    return NextResponse.json({ success: true, category })
  } catch (error) {
    console.error("Error updating category:", error)
    return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params before using it
    const resolvedParams = await params

    // Convert string ID to number
    const categoryId = Number.parseInt(resolvedParams.id, 10)

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: "Invalid category ID" }, { status: 400 })
    }

    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Check if category exists and has patterns
    const existingCategory = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      include: {
        PatternCategory: true,
      },
    })

    if (!existingCategory) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    // Check if category has patterns
    if (existingCategory.PatternCategory.length > 0) {
      return NextResponse.json({ error: "Cannot delete category with associated patterns" }, { status: 400 })
    }

    // Delete category
    await prisma.category.delete({
      where: {
        id: categoryId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}
