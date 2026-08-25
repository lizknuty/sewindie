import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"
import { getAdapterForDesigner } from "@/lib/pattern-sync/registry"
import { normalizeUrl } from "@/lib/pattern-sync/compare"

// The only endpoint in this feature that writes to the catalogue. Every row it
// inserts was explicitly selected by an admin, and each one is re-validated and
// re-checked for duplicates here -- the client's claim that something is "new"
// is never trusted.

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Generous enough for a first-time backfill, bounded enough that a malformed
// request can't try to insert thousands of rows.
const MAX_BATCH = 500

type IncomingRow = {
  name?: unknown
  url?: unknown
  imageUrl?: unknown
  releaseDate?: unknown
}

/** Parses an ISO date into a Date, or null when absent/invalid. */
function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function POST(request: Request) {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  let designerId: number
  let incoming: IncomingRow[]
  try {
    const body = await request.json()
    designerId = Number(body?.designerId)
    incoming = Array.isArray(body?.patterns) ? body.patterns : []
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!Number.isInteger(designerId) || designerId <= 0) {
    return NextResponse.json({ error: "A valid designerId is required" }, { status: 400 })
  }
  if (incoming.length === 0) {
    return NextResponse.json({ error: "No patterns were selected" }, { status: 400 })
  }
  if (incoming.length > MAX_BATCH) {
    return NextResponse.json({ error: `Too many patterns in one import (max ${MAX_BATCH})` }, { status: 400 })
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
    return NextResponse.json({ error: `No sync script exists for ${designer.name} yet.` }, { status: 400 })
  }

  // Hosts this designer is allowed to own, so a bad payload can't attach a
  // link for some other site to this designer.
  const allowedHosts = new Set(adapter.matchHosts.map((host) => host.replace(/^www\./, "").toLowerCase()))

  // Current URLs for this designer, so a double-submit can't duplicate rows.
  const existing = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: { url: true },
  })
  const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter((u): u is string => Boolean(u)))

  const toCreate: { name: string; designer_id: number; url: string; thumbnail_url: string | null; release_date: Date | null }[] = []
  const rejected: { name: string; reason: string }[] = []

  for (const row of incoming) {
    const name = typeof row.name === "string" ? row.name.trim() : ""
    const url = typeof row.url === "string" ? row.url.trim() : ""
    const label = name || url || "(unnamed)"

    if (!name) {
      rejected.push({ name: label, reason: "Missing name" })
      continue
    }
    // Pattern.name is VarChar(255).
    if (name.length > 255) {
      rejected.push({ name: label, reason: "Name too long" })
      continue
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      rejected.push({ name: label, reason: "Invalid URL" })
      continue
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      rejected.push({ name: label, reason: "URL must be http(s)" })
      continue
    }
    if (!allowedHosts.has(parsedUrl.hostname.toLowerCase().replace(/^www\./, ""))) {
      rejected.push({ name: label, reason: "URL does not belong to this designer" })
      continue
    }

    const normalized = normalizeUrl(url)
    if (!normalized || takenUrls.has(normalized)) {
      rejected.push({ name: label, reason: "Already in the catalogue" })
      continue
    }
    // Also blocks duplicates within this same payload.
    takenUrls.add(normalized)

    const imageUrl = typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl.trim() : null

    toCreate.push({
      name,
      designer_id: designer.id,
      url,
      thumbnail_url: imageUrl,
      release_date: parseDate(row.releaseDate),
    })
  }

  let imported = 0
  if (toCreate.length > 0) {
    const result = await prisma.pattern.createMany({ data: toCreate })
    imported = result.count
  }

  return NextResponse.json({
    imported,
    skipped: rejected.length,
    rejected: rejected.slice(0, 20),
    designer: { id: designer.id, name: designer.name },
  })
}
