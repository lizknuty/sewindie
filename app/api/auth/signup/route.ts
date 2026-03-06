import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

async function verifyTurnstileToken(token: string): Promise<boolean> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    }),
  })
  
  const data = await response.json()
  return data.success === true
}

export async function POST(request: Request) {
  try {
    const { name, email, password, turnstileToken } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // Verify Turnstile token
    if (!turnstileToken) {
      return NextResponse.json({ message: "Please complete the security check." }, { status: 400 })
    }

    const isValidToken = await verifyTurnstileToken(turnstileToken)
    if (!isValidToken) {
      return NextResponse.json({ message: "Security verification failed. Please try again." }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        hashedPassword,
        role: "USER", // Default role
      },
    })

    // Do not return hashedPassword in the response
    const { hashedPassword: _, ...userWithoutPassword } = newUser

    return NextResponse.json(userWithoutPassword, { status: 201 })
  } catch (error) {
    console.error("Error during user registration:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
