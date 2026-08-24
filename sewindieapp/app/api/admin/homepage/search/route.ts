import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAdminAccess } from "@/lib/admin-middleware"

/**
 * Typeahead for the curation picker. Returns published records only — pinning a
 * draft would surface it on the homepage, bypassing the status filter that the
 * public rails apply.
 */
export async function GET(request: Request) {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  const { searchParams } = new URL(request.url)
  const kind = searchParams.get("kind")
  const query = (searchParams.get("q") ?? "").trim()

  if (kind !== "designer" && kind !== "pattern") {
    return NextResponse.json({ error: "kind must be 'designer' or 'pattern'" }, { status: 400 })
  }

  if (kind === "designer") {
    const rows = await prisma.designer.findMany({
      where: {
        status: "PUBLISHED",
        ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, logo_url: true },
    })
    return NextResponse.json({
      results: rows.map((row) => ({ id: row.id, name: row.name, imageUrl: row.logo_url, subtitle: null })),
    })
  }

  const rows = await prisma.pattern.findMany({
    where: {
      status: "PUBLISHED",
      ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
    },
    orderBy: { id: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      thumbnail_url: true,
      designer: { select: { name: true } },
    },
  })

  return NextResponse.json({
    results: rows.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.thumbnail_url,
      subtitle: row.designer?.name ?? null,
    })),
  })
}
