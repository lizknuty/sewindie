import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import bcryptjs from "bcryptjs"

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

export async function POST(req: Request) {
  try {
    const { name, email, password, turnstileToken } = await req.json()

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
      return NextResponse.json({ message: "User already exists" }, { status: 400 })
    }

    const hashedPassword = await bcryptjs.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "USER", // Set default role
      },
    })

    return NextResponse.json({ message: "User created successfully" }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ message: "An error occurred" }, { status: 500 })
  }
}
