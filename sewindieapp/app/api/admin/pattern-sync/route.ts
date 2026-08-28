import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"
import { getAdapterForDesigner } from "@/lib/pattern-sync/registry"
import { comparePatterns } from "@/lib/pattern-sync/compare"

// Read-only: fetches a designer's live catalogue and reports what's new.
// Writes nothing -- importing is a separate, explicitly confirmed step.

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  let designerId: number
  try {
    const body = await request.json()
    designerId = Number(body?.designerId)
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!Number.isInteger(designerId) || designerId <= 0) {
    return NextResponse.json({ error: "A valid designerId is required" }, { status: 400 })
  }

  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
    select: { id: true, name: true, url: true },
  })

  if (!designer) {
    return NextResponse.json({ error: "Designer not found" }, { status: 404 })
  }

  const adapter = getAdapterForDesigner(designer)
  if (!adapter) {
    return NextResponse.json(
      { error: `No sync script exists for ${designer.name} yet.` },
      { status: 400 },
    )
  }

  let scraped
  try {
    scraped = await adapter.fetchCatalogue()
  } catch (error) {
    // Surface the real reason -- a timeout and a layout change need different fixes.
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Could not read the store: ${message}` }, { status: 502 })
  }

  const existing = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: { id: true, name: true, url: true },
  })

  const { rows, summary } = comparePatterns(scraped, existing, {
    identityKey: adapter.identityKey?.bind(adapter),
  })

  // Record that the script ran, with the outcome, so the page can show when a
  // designer was last checked. This is bookkeeping: if it fails, the admin still
  // gets their results, so a write error must never turn a good check into a 500.
  let lastRun: { ranAt: string } | null = null
  try {
    const run = await prisma.patternSyncRun.create({
      data: {
        designer_id: designer.id,
        found: summary.found,
        new_count: summary.new,
        possible_matches: summary.possibleMatches,
        existing: summary.existing,
      },
      select: { ran_at: true },
    })
    lastRun = { ranAt: run.ran_at.toISOString() }
  } catch (error) {
    console.error("failed to record pattern sync run", error)
  }

  return NextResponse.json({
    designer: { id: designer.id, name: designer.name },
    adapter: { slug: adapter.slug, label: adapter.label },
    summary: { ...summary, inCatalogue: existing.length },
    lastRun,
    // Only actionable rows travel to the client; EXISTING is just a count.
    rows: rows.filter((row) => row.status !== "EXISTING"),
  })
}
