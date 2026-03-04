import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import crypto from "crypto"
import { Resend } from "resend"
import { emailTemplates } from "@/lib/email-templates"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // For security, do not reveal if the email exists or not
      return NextResponse.json(
        { message: "If an account with that email exists, a password reset link has been sent." },
        { status: 200 },
      )
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex")
    const resetExpires = new Date(Date.now() + 3600000) // 1 hour from now

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires,
      },
    })

    const resetLink = `${process.env.NEXTAUTH_URL}/reset-password/${resetToken}`

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Replace with your verified Resend domain
      to: email,
      subject: emailTemplates.passwordReset.subject,
      html: emailTemplates.passwordReset.html({ resetLink }),
      text: emailTemplates.passwordReset.text({ resetLink }),
    })

    if (error) {
      console.error("Error sending email:", error)
      return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 })
    }

    return NextResponse.json(
      { message: "If an account with that email exists, a password reset link has been sent." },
      { status: 200 },
    )
  } catch (error) {
    console.error("Forgot password API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
