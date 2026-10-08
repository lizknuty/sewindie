import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcryptjs from "bcryptjs"
import crypto from "crypto"
import { checkAdminAccess } from "@/lib/admin-middleware"

export async function GET() {
  try {
    // Check admin access
    const { authorized, response, session } = await checkAdminAccess()
    if (!authorized) return response

    // Get users (excluding password)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const { authorized, response, session } = await checkAdminAccess()
    if (!authorized) return response

    // Get request body
    const { name, email, role } = await request.json()

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 })
    }

    // The password column is required, so store a hash of a random secret nobody knows.
    // The user sets a real password through the "Forgot password" flow.
    const hashedPassword = await bcryptjs.hash(crypto.randomBytes(32).toString("hex"), 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "USER",
        emailVerified: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, user }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ success: false, error: "Failed to create user" }, { status: 500 })
  }
}
