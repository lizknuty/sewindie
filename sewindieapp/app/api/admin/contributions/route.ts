import { type NextRequest, NextResponse } from "next/server"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { getPatternContributions, updateContributionStatus } from "@/lib/google-sheets"

export async function GET() {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get contributions from Google Sheets
    const contributions = await getPatternContributions()

    return NextResponse.json({ success: true, contributions })
  } catch (error) {
    console.error("Error fetching contributions:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch contributions" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check moderator access
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    // Get request body
    const { rowIndex, status } = await request.json()

    // Validate required fields
    if (!rowIndex || !status) {
      return NextResponse.json({ error: "Row index and status are required" }, { status: 400 })
    }

    // Update contribution status
    const success = await updateContributionStatus(rowIndex, status)

    if (!success) {
      return NextResponse.json({ success: false, error: "Failed to update contribution status" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating contribution status:", error)
    return NextResponse.json({ success: false, error: "Failed to update contribution status" }, { status: 500 })
  }
}
