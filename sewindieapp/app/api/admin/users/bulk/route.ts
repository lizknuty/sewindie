import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { prisma } from "@/lib/prisma"

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userIds, action } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "No user IDs provided" }, { status: 400 })
    }

    if (!action || !["suspend", "activate"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Get current user ID to prevent self-modification
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true }
    })

    // Filter out current user and admin users from bulk operations
    const usersToUpdate = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        NOT: [
          { id: currentUser?.id },
          { role: "ADMIN" }
        ]
      },
      select: { id: true }
    })

    const validUserIds = usersToUpdate.map(u => u.id)

    if (validUserIds.length === 0) {
      return NextResponse.json({ 
        error: "No valid users to update. Cannot modify admin accounts or your own account." 
      }, { status: 400 })
    }

    const newStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE"

    // Update users in bulk
    const result = await prisma.user.updateMany({
      where: {
        id: { in: validUserIds }
      },
      data: {
        status: newStatus
      }
    })

    return NextResponse.json({ 
      success: true, 
      updatedCount: result.count,
      skippedCount: userIds.length - result.count,
      message: `${result.count} user(s) ${action === "suspend" ? "suspended" : "activated"}`
    })
  } catch (error) {
    console.error("Error in bulk user update:", error)
    return NextResponse.json({ success: false, error: "Failed to update users" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userIds } = await request.json()

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "No user IDs provided" }, { status: 400 })
    }

    // Get current user ID to prevent self-deletion
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true }
    })

    // Filter out current user and admin users from deletion
    const usersToDelete = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        NOT: [
          { id: currentUser?.id },
          { role: "ADMIN" }
        ]
      },
      select: { id: true }
    })

    const validUserIds = usersToDelete.map(u => u.id)

    if (validUserIds.length === 0) {
      return NextResponse.json({ 
        error: "No valid users to delete. Cannot delete admin accounts or your own account." 
      }, { status: 400 })
    }

    // Delete users in bulk
    const result = await prisma.user.deleteMany({
      where: {
        id: { in: validUserIds }
      }
    })

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      skippedCount: userIds.length - result.count,
      message: `${result.count} user(s) deleted`
    })
  } catch (error) {
    console.error("Error in bulk user delete:", error)
    return NextResponse.json({ success: false, error: "Failed to delete users" }, { status: 500 })
  }
}
