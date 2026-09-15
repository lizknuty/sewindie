import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { Resend } from "resend"
import { getPasswordResetEmailTemplate } from "@/lib/email-templates"

const resend = new Resend(process.env.RESEND_API_KEY)

async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  })

  const data = await response.json()
  return data.success === true
}

// Lightweight in-memory rate limit as defense-in-depth alongside the CAPTCHA.
// Keyed by client IP; caps reset requests within a rolling window. This is
// per-instance (not shared across serverless instances), which is acceptable
// as a second layer behind Turnstile — for a hard global limit, back this with
// a shared store like Redis.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const resetRequestLog = new Map<string, number[]>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = (resetRequestLog.get(key) || []).filter((t) => t > windowStart)

  if (timestamps.length >= RATE_LIMIT_MAX) {
    resetRequestLog.set(key, timestamps)
    return true
  }

  timestamps.push(now)
  resetRequestLog.set(key, timestamps)
  return false
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

export async function POST(req: Request) {
  try {
    const { email, turnstileToken } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const clientIp = getClientIp(req)

    // Rate limit before doing any work so abusive clients can't hammer the endpoint.
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      )
    }

    // Verify the Turnstile CAPTCHA token.
    if (!turnstileToken) {
      return NextResponse.json({ error: "Please complete the security check." }, { status: 400 })
    }

    const isValidToken = await verifyTurnstileToken(turnstileToken, clientIp)
    if (!isValidToken) {
      return NextResponse.json({ error: "Security verification failed. Please try again." }, { status: 400 })
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

    // Send email with reset link.
    // The Resend SDK does NOT throw on API errors — it returns { data, error }.
    // We must inspect `error` explicitly, otherwise a rejected send (e.g. an
    // unverified sending domain) looks like a success and the user never gets
    // an email while the UI reports that a link was sent.
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@sewindie.com"
    const { error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Reset your password",
      html: getPasswordResetEmailTemplate(resetUrl, user.name || undefined),
    })

    if (resendError) {
      console.error("[v0] Resend failed to send password reset email:", {
        from: fromEmail,
        error: resendError,
      })
      return NextResponse.json({ error: "Failed to send password reset email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Password reset request error:", error)
    return NextResponse.json({ error: "Failed to process password reset request" }, { status: 500 })
  }
}
