import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"
import { getAdapterForDesigner } from "@/lib/pattern-sync/registry"
import { normalizeUrl } from "@/lib/pattern-sync/compare"
import { applyMetadata, loadVocab } from "@/lib/pattern-sync/metadata/writer"
import { emptyMetadata, type ExtractedMetadata } from "@/lib/pattern-sync/metadata/types"

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
  metadata?: unknown
}

/**
 * Coerces an untrusted `metadata` payload into an ExtractedMetadata. The client
 * echoes back what the adapter produced, so we accept only string arrays and
 * drop anything malformed rather than trusting the shape.
 */
function parseMetadata(value: unknown): ExtractedMetadata | null {
  if (!value || typeof value !== "object") return null
  const src = value as Record<string, unknown>
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []

  const meta = emptyMetadata()
  meta.audiences = arr(src.audiences)
  meta.categories = arr(src.categories)
  meta.fabricTypes = arr(src.fabricTypes)
  meta.attributes = arr(src.attributes)
  meta.suggestedFabrics = arr(src.suggestedFabrics)
  // Difficulty is a scalar; the writer applies it additively (only when the
  // pattern has none yet). Accept a non-empty string, drop anything else.
  meta.difficulty =
    typeof src.difficulty === "string" && src.difficulty.trim().length > 0 ? src.difficulty.trim() : null

  const hasAny =
    meta.audiences.length ||
    meta.categories.length ||
    meta.fabricTypes.length ||
    meta.attributes.length ||
    meta.suggestedFabrics.length ||
    meta.difficulty
  return hasAny ? meta : null
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
  // link for some other site to this designer. Defaults to the adapter's match
  // hosts, but an adapter whose patterns live on a different domain than the
  // designer's own site (e.g. Liesl + Co, sold on the shared oliverands.com
  // store) overrides this with `importHosts`.
  const allowedHosts = new Set(
    (adapter.importHosts ?? adapter.matchHosts).map((host) => host.replace(/^www\./, "").toLowerCase()),
  )

  // Current URLs for this designer, so a double-submit can't duplicate rows.
  const existing = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: { url: true },
  })
  const takenUrls = new Set(existing.map((p) => normalizeUrl(p.url)).filter((u): u is string => Boolean(u)))

  // Where an adapter defines a narrower identity than the URL, the URL set above
  // is not enough on its own. Grasser serves one pattern under several category
  // paths, so a row already in the catalogue under one path would sail past a
  // URL-only check and duplicate the pattern. Keyed separately so a store
  // without an identityKey behaves exactly as before.
  const identityKey = adapter.identityKey?.bind(adapter)
  const takenIdentities = new Set(
    identityKey ? existing.map((p) => identityKey(p.url)).filter((k): k is string => Boolean(k)) : [],
  )

  const toCreate: { name: string; designer_id: number; url: string; thumbnail_url: string | null; release_date: Date | null }[] = []
  // Metadata keyed by normalized URL so we can attach it after createMany (which
  // does not return ids) by looking the freshly-created rows back up.
  const metadataByUrl = new Map<string, ExtractedMetadata>()
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

    const identity = identityKey?.(url) ?? null
    if (identity && takenIdentities.has(identity)) {
      rejected.push({ name: label, reason: "Already in the catalogue under a different path" })
      continue
    }

    // Also blocks duplicates within this same payload.
    takenUrls.add(normalized)
    if (identity) takenIdentities.add(identity)

    const imageUrl = typeof row.imageUrl === "string" && row.imageUrl.trim() ? row.imageUrl.trim() : null

    const meta = parseMetadata(row.metadata)
    if (meta) metadataByUrl.set(normalized, meta)

    toCreate.push({
      name,
      designer_id: designer.id,
      url,
      thumbnail_url: imageUrl,
      release_date: parseDate(row.releaseDate),
    })
  }

  let imported = 0
  let metadataApplied = 0
  const vocabMissing = new Map<string, { dimension: string; name: string }>()
  if (toCreate.length > 0) {
    const result = await prisma.pattern.createMany({ data: toCreate })
    imported = result.count

    // Attach metadata to the rows we just created. createMany returns no ids,
    // so re-read this designer's patterns and match by normalized URL.
    if (metadataByUrl.size > 0) {
      const vocab = await loadVocab(prisma)
      const created = await prisma.pattern.findMany({
        where: { designer_id: designer.id },
        select: { id: true, url: true },
      })
      for (const p of created) {
        const key = normalizeUrl(p.url)
        const meta = key ? metadataByUrl.get(key) : undefined
        if (!meta) continue
        const plan = await applyMetadata(prisma, p.id, meta, vocab, true)
        const added =
          plan.toAdd.audience.length +
          plan.toAdd.category.length +
          plan.toAdd.fabricType.length +
          plan.toAdd.attribute.length +
          plan.toAdd.suggestedFabric.length
        if (added > 0) metadataApplied++
        for (const miss of plan.vocabMissing) {
          vocabMissing.set(`${miss.dimension}:${miss.name}`, miss)
        }
      }
    }
  }

  return NextResponse.json({
    imported,
    metadataApplied,
    vocabMissing: [...vocabMissing.values()].slice(0, 50),
    skipped: rejected.length,
    rejected: rejected.slice(0, 20),
    designer: { id: designer.id, name: designer.name },
  })
}
