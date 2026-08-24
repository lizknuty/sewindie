import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

type Kind = "designer" | "pattern"

function parseKind(value: unknown): Kind | null {
  return value === "designer" || value === "pattern" ? value : null
}

/**
 * Validates a list of ids coming from the client. The reorder/save endpoint
 * rewrites positions from array order, so the only thing we need to trust is
 * that these are real, positive, non-duplicated integer ids.
 */
function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const ids: number[] = []
  for (const raw of value) {
    const n = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isInteger(n) || n <= 0) return null
    if (ids.includes(n)) return null
    ids.push(n)
  }
  return ids
}

// A rail only ever shows a handful of items; this stops a malformed or hostile
// payload from writing thousands of rows.
const MAX_PINNED = 24

export async function GET() {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  const [designers, patterns] = await Promise.all([
    prisma.featuredDesigner.findMany({
      orderBy: { position: "asc" },
      include: { Designer: { select: { id: true, name: true, logo_url: true } } },
    }),
    prisma.featuredPattern.findMany({
      orderBy: { position: "asc" },
      include: {
        Pattern: {
          select: {
            id: true,
            name: true,
            thumbnail_url: true,
            designer: { select: { name: true } },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    designers: designers.map((row) => ({
      id: row.Designer.id,
      name: row.Designer.name,
      imageUrl: row.Designer.logo_url,
    })),
    patterns: patterns.map((row) => ({
      id: row.Pattern.id,
      name: row.Pattern.name,
      imageUrl: row.Pattern.thumbnail_url,
      subtitle: row.Pattern.designer?.name ?? null,
    })),
  })
}

/**
 * Replaces the pinned list for one rail. The client sends the full ordered list
 * of ids, so add, remove, and reorder are all the same operation — which keeps
 * positions contiguous and avoids the drift that per-item PATCHes cause.
 */
export async function PUT(request: Request) {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as { kind?: unknown; ids?: unknown }
  const kind = parseKind(payload.kind)
  if (!kind) {
    return NextResponse.json({ error: "kind must be 'designer' or 'pattern'" }, { status: 400 })
  }

  const ids = parseIds(payload.ids)
  if (!ids) {
    return NextResponse.json(
      { error: "ids must be an array of unique positive integers" },
      { status: 400 },
    )
  }
  if (ids.length > MAX_PINNED) {
    return NextResponse.json({ error: `At most ${MAX_PINNED} items can be pinned` }, { status: 400 })
  }

  // Reject ids that don't exist rather than letting the FK throw, so the client
  // gets a clear message instead of a 500.
  if (ids.length > 0) {
    const found =
      kind === "designer"
        ? await prisma.designer.findMany({ where: { id: { in: ids } }, select: { id: true } })
        : await prisma.pattern.findMany({ where: { id: { in: ids } }, select: { id: true } })
    if (found.length !== ids.length) {
      const missing = ids.filter((id) => !found.some((row) => row.id === id))
      return NextResponse.json(
        { error: `Unknown ${kind} id(s): ${missing.join(", ")}` },
        { status: 400 },
      )
    }
  }

  // Delete-then-insert in a transaction: the table is tiny, and this keeps the
  // stored positions a clean 0..n-1 with no gaps to reconcile later.
  if (kind === "designer") {
    await prisma.$transaction([
      prisma.featuredDesigner.deleteMany({}),
      prisma.featuredDesigner.createMany({
        data: ids.map((designer_id, position) => ({ designer_id, position })),
      }),
    ])
  } else {
    await prisma.$transaction([
      prisma.featuredPattern.deleteMany({}),
      prisma.featuredPattern.createMany({
        data: ids.map((pattern_id, position) => ({ pattern_id, position })),
      }),
    ])
  }

  // The homepage has no `revalidate`/`dynamic` export, so it is prerendered at
  // build time. Without this the saved order would not appear until the next
  // deploy. Invalidating on save keeps the page cached for visitors instead of
  // making it dynamic on every request.
  revalidatePath("/")

  return NextResponse.json({ success: true, count: ids.length })
}
