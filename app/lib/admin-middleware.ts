import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"

export async function checkAdminAccess() {
  const session = await getServerSession(authOptions)

  if (!session || !session.user || session.user.role !== "ADMIN") {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { authorized: true, response: null }
}
