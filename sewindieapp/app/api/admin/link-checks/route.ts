import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { collectProbes, probeAll, saveResults } from "@/lib/link-check"

/** Cap per request so this stays well inside the serverless execution budget. */
const MAX_BATCH = 150

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role?.toUpperCase()

  if (!session || (role !== "ADMIN" && role !== "MODERATOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const requested = Number(body?.limit)
    const limit = Number.isFinite(requested) ? Math.min(Math.max(1, requested), MAX_BATCH) : MAX_BATCH
    // A manual re-check should re-probe anything not verified in the last hour.
    const staleHours = body?.recheckAll === true ? 0 : 1

    const probes = await collectProbes(limit, staleHours)

    if (probes.length === 0) {
      return NextResponse.json({ checked: 0, remaining: 0, message: "Everything has been checked recently." })
    }

    const results = await probeAll(probes)
    await saveResults(results)

    const tally = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {})

    const remaining = (await collectProbes(1, staleHours)).length

    return NextResponse.json({
      checked: results.length,
      tally,
      hasMore: remaining > 0,
    })
  } catch (error) {
    console.error("[v0] link check failed:", error)
    return NextResponse.json({ error: "Link check failed" }, { status: 500 })
  }
}
