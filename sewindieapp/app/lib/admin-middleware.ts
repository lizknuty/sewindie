import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"

export async function checkAdminAccess() {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Check for admin role
  if (session.user.role !== "ADMIN") {
    return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { authorized: true, session }
}

export async function checkModeratorAccess() {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  // Check for admin or moderator role
  if (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR") {
    return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { authorized: true, session }
}
