import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user || !user.hashedPassword) {
      return NextResponse.json({ error: "User not found or password not set" }, { status: 404 })
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.hashedPassword)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid current password" }, { status: 401 })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        hashedPassword: hashedNewPassword,
      },
    })

    return NextResponse.json({ message: "Password changed successfully" }, { status: 200 })
  } catch (error) {
    console.error("Change password API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
