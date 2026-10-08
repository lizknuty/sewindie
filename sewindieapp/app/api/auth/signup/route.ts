import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcryptjs from "bcryptjs"
import {
  checkFormToken,
  getClientIp,
  isSignupRateLimited,
  validateSignupInput,
  verifySignupTurnstile,
} from "@/lib/signup-guard"
import { issueVerificationEmail } from "@/lib/email-verification"

// Looks identical to a real success so bots that trip a silent trap get no
// signal to adapt against.
function decoySuccess() {
  return NextResponse.json({ message: "User created successfully" }, { status: 201 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const clientIp = getClientIp(req)

    if (typeof body.website === "string" && body.website.trim() !== "") {
      console.warn("[signup] honeypot tripped", { ip: clientIp })
      return decoySuccess()
    }

    const formTokenStatus = checkFormToken(body.formToken)
    if (formTokenStatus === "invalid") {
      console.warn("[signup] missing or forged form token", { ip: clientIp })
      return decoySuccess()
    }
    if (formTokenStatus === "too-fast") {
      console.warn("[signup] form submitted too quickly", { ip: clientIp })
      return NextResponse.json({ message: "Please take a moment and try again." }, { status: 400 })
    }
    if (formTokenStatus === "expired") {
      return NextResponse.json(
        { message: "This form has expired. Please refresh the page and try again." },
        { status: 400 },
      )
    }

    if (isSignupRateLimited(clientIp)) {
      console.warn("[signup] rate limited", { ip: clientIp })
      return NextResponse.json(
        { message: "Too many accounts created from this network. Please try again later." },
        { status: 429 },
      )
    }

    if (!body.turnstileToken || typeof body.turnstileToken !== "string") {
      return NextResponse.json({ message: "Please complete the security check." }, { status: 400 })
    }

    const turnstile = await verifySignupTurnstile(body.turnstileToken, clientIp, req.headers.get("host"))
    if (!turnstile.ok) {
      console.warn("[signup] turnstile rejected", { ip: clientIp, reason: turnstile.reason })
      return NextResponse.json({ message: "Security verification failed. Please try again." }, { status: 400 })
    }

    const input = validateSignupInput(body)
    if (!input.ok) {
      return NextResponse.json({ message: input.message }, { status: 400 })
    }
    const { name, email, password } = input.value

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ message: "User already exists" }, { status: 400 })
    }

    const hashedPassword = await bcryptjs.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER",
      },
      select: { id: true, email: true, name: true, emailVerificationExpires: true },
    })

    // A failed send isn't fatal: the user can request a new link from the login page.
    await issueVerificationEmail(user, req)

    return NextResponse.json({ message: "User created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "An error occurred" }, { status: 500 })
  }
}
