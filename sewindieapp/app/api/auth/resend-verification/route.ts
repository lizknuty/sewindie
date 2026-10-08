import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getClientIp } from "@/lib/signup-guard"
import { issueVerificationEmail, isWithinResendCooldown } from "@/lib/email-verification"

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const requestLog = new Map<string, number[]>()

function isRateLimited(key: string) {
  const now = Date.now()
  const recent = (requestLog.get(key) || []).filter((t) => t > now - RATE_LIMIT_WINDOW_MS)
  const limited = recent.length >= RATE_LIMIT_MAX
  if (!limited) recent.push(now)
  requestLog.set(key, recent)
  return limited
}

// Always the same response, so this endpoint can't be used to discover which emails have accounts.
const GENERIC_RESPONSE = {
  message: "If that account exists and still needs confirming, we've sent a new link.",
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (typeof email !== "string" || email.length > 254 || !email.includes("@")) {
      return NextResponse.json({ message: "Please enter a valid email address." }, { status: 400 })
    }

    if (isRateLimited(getClientIp(req))) {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true, email: true, name: true, emailVerified: true, emailVerificationExpires: true },
    })

    if (user && !user.emailVerified && !isWithinResendCooldown(user)) {
      await issueVerificationEmail(user, req)
    }

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json({ message: "An error occurred" }, { status: 500 })
  }
}
