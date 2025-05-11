import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../[...nextauth]/options"

export async function GET() {
  // Check if NEXTAUTH_SECRET is defined (don't return the actual value for security)
  const hasSecret = !!process.env.NEXTAUTH_SECRET

  // Check if we can get a session
  let sessionError = null
  let hasSession = false
  let sessionData = null

  try {
    const session = await getServerSession(authOptions)
    hasSession = !!session
    sessionData = session
      ? {
          user: {
            name: session.user?.name,
            email: session.user?.email,
            role: session.user?.role,
          },
        }
      : null
  } catch (error) {
    sessionError = error instanceof Error ? error.message : "Unknown error"
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    hasNextAuthSecret: hasSecret,
    secretLength: hasSecret ? process.env.NEXTAUTH_SECRET?.length : 0,
    hasSession,
    sessionData,
    sessionError,
  })
}
