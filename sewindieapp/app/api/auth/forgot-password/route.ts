import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import crypto from "crypto"
import { Resend } from "resend"
import { getPasswordResetEmailTemplate } from "@/lib/email-templates"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Don't reveal if user exists or not for security
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString("hex")

    // Set token expiration (1 hour from now)
    const resetTokenExpires = new Date(Date.now() + 3600000)

    // Save token to user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    })

    // Create reset URL with the correct path
    // Handle the null case explicitly
    const originHeader = req.headers.get("origin")
    const origin = originHeader !== null ? originHeader : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const resetUrl = `${origin}/reset-password/${resetToken}`

    // Send email with reset link
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@sewindie.com",
      to: user.email,
      subject: "Reset your password",
      html: getPasswordResetEmailTemplate(resetUrl, user.name || undefined),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Failed to process password reset request" }, { status: 500 })
  }
}
