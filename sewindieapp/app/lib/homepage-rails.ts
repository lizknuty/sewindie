import { prisma } from "@/lib/prisma"

/**
 * Shared sizing for the two curated homepage rails.
 *
 * The public homepage (app/page.tsx) and the admin curation screen
 * (app/admin/homepage) both need these numbers, and they were briefly
 * duplicated — the admin said "6 slots" while the homepage actually loaded 10,
 * so the admin under-reported how many designers were on the page. Keep them
 * here so the two screens cannot drift apart again.
 */

/** Designers loaded into the "Featured Designers" rail. */
export const DESIGNER_SLOTS = 10

/** Patterns loaded into the "New & Noteworthy" rail. */
export const PATTERN_SLOTS = 12

/**
 * Designer cards visible per view. The rail is a horizontal scroller sized to
 * fit exactly six across on desktop, so slots 7-10 are one arrow press away
 * rather than hidden. See `.home-designer-item` in app/styles.css.
 *
 * The pattern rail has no equivalent: it is a 6-column grid that renders all
 * PATTERN_SLOTS at once, so every pinned pattern is immediately visible.
 */
export const DESIGNER_VISIBLE = 6

/**
 * Puts editorially pinned rows first (in their saved order) and backfills the
 * rest from the automatic list, skipping anything already pinned so nothing
 * appears twice. Curation is additive: with nothing pinned this returns the
 * automatic ordering untouched.
 */
export function pinnedFirst<T extends { id: number }>(pinned: T[], auto: T[], limit: number): T[] {
  const pinnedIds = new Set(pinned.map((row) => row.id))
  return [...pinned, ...auto.filter((row) => !pinnedIds.has(row.id))].slice(0, limit)
}

/** Reorders rows fetched by `id: { in: ids }` back into the given id order. */
export function inIdOrder<T extends { id: number }>(ids: number[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined)
}

const DESIGNER_CARD = { id: true, name: true, logo_url: true } as const

export type FeaturedDesignerRow = { id: number; name: string; logoUrl: string | null }

/**
 * The "Featured Designers" rail contents.
 *
 * Extracted from app/page.tsx so the designers index can render the identical
 * rail. Duplicating the pin-then-backfill query here would mean the two rails
 * could silently disagree about what is featured, which is exactly the drift
 * the slot constants above already exist to prevent.
 */
export async function getFeaturedDesigners(): Promise<FeaturedDesignerRow[]> {
  const pinnedRows = await prisma.featuredDesigner.findMany({
    orderBy: { position: "asc" },
    select: { designer_id: true },
  })
  const pinnedIds = pinnedRows.map((row) => row.designer_id)

  // Pinned rows are fetched by id in their own query rather than plucked out of
  // the automatic list. A hand-picked designer with few patterns ranks low
  // under `orderBy: patterns desc` and would fall outside the `take` window, so
  // filtering the automatic list would silently drop it from the rail.
  const [pinned, auto] = await Promise.all([
    pinnedIds.length
      ? prisma.designer.findMany({ where: { id: { in: pinnedIds } }, select: DESIGNER_CARD })
      : Promise.resolve([]),
    prisma.designer.findMany({
      take: DESIGNER_SLOTS + pinnedIds.length,
      select: DESIGNER_CARD,
      orderBy: { patterns: { _count: "desc" } },
    }),
  ])

  return pinnedFirst(inIdOrder(pinnedIds, pinned), auto, DESIGNER_SLOTS).map((d) => ({
    id: d.id,
    name: d.name,
    logoUrl: d.logo_url,
  }))
}
