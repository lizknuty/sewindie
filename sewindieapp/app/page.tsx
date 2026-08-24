import { prisma } from "@/lib/prisma"
import { DESIGNER_SLOTS, PATTERN_SLOTS } from "@/lib/homepage-rails"
import HomeHero from "./components/HomeHero"
import FeaturedDesigners from "./components/FeaturedDesigners"
import NewNoteworthyPatterns from "./components/NewNoteworthyPatterns"
import CommunityCallout from "./components/CommunityCallout"

/**
 * Puts editorially pinned rows first (in their saved order) and backfills the
 * rest from the automatic list, skipping anything already pinned so nothing
 * appears twice. Curation is additive: with nothing pinned this returns the
 * automatic ordering untouched.
 */
function pinnedFirst<T extends { id: number }>(pinned: T[], auto: T[], limit: number): T[] {
  const pinnedIds = new Set(pinned.map((row) => row.id))
  return [...pinned, ...auto.filter((row) => !pinnedIds.has(row.id))].slice(0, limit)
}

/** Reorders rows fetched by `id: { in: ids }` back into the given id order. */
function inIdOrder<T extends { id: number }>(ids: number[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined)
}

const DESIGNER_CARD = { id: true, name: true, logo_url: true } as const
const PATTERN_CARD = {
  id: true,
  name: true,
  thumbnail_url: true,
  designer: { select: { name: true } },
  _count: { select: { favorites: true } },
} as const

export default async function Home() {
  const [pinnedDesignerRows, pinnedPatternRows] = await Promise.all([
    prisma.featuredDesigner.findMany({ orderBy: { position: "asc" }, select: { designer_id: true } }),
    prisma.featuredPattern.findMany({ orderBy: { position: "asc" }, select: { pattern_id: true } }),
  ])

  const pinnedDesignerIds = pinnedDesignerRows.map((row) => row.designer_id)
  const pinnedPatternIds = pinnedPatternRows.map((row) => row.pattern_id)

  // Pinned rows are fetched by id in their own query rather than plucked out of
  // the automatic list. A hand-picked designer with few patterns ranks low under
  // `orderBy: patterns desc` and would fall outside the `take` window, so
  // filtering the automatic list would silently drop it from the rail.
  const [pinnedDesigners, pinnedPatterns, autoDesigners, autoPatterns] = await Promise.all([
    pinnedDesignerIds.length
      ? prisma.designer.findMany({ where: { id: { in: pinnedDesignerIds } }, select: DESIGNER_CARD })
      : Promise.resolve([]),
    pinnedPatternIds.length
      ? prisma.pattern.findMany({ where: { id: { in: pinnedPatternIds } }, select: PATTERN_CARD })
      : Promise.resolve([]),
    prisma.designer.findMany({
      take: DESIGNER_SLOTS + pinnedDesignerIds.length,
      select: DESIGNER_CARD,
      orderBy: { patterns: { _count: "desc" } },
    }),
    prisma.pattern.findMany({
      take: PATTERN_SLOTS + pinnedPatternIds.length,
      select: PATTERN_CARD,
      orderBy: { id: "desc" },
    }),
  ])

  const featuredDesigners = pinnedFirst(
    inIdOrder(pinnedDesignerIds, pinnedDesigners),
    autoDesigners,
    DESIGNER_SLOTS,
  )
  const featuredPatterns = pinnedFirst(
    inIdOrder(pinnedPatternIds, pinnedPatterns),
    autoPatterns,
    PATTERN_SLOTS,
  )

  return (
    <div className="home-page">
      <HomeHero />

      <div className="home-body">
        <div className="container px-4">
          <FeaturedDesigners
            designers={featuredDesigners.map((d) => ({
              id: d.id,
              name: d.name,
              logoUrl: d.logo_url,
            }))}
          />

          <NewNoteworthyPatterns
            patterns={featuredPatterns.map((p) => ({
              id: p.id,
              name: p.name,
              designerName: p.designer.name,
              // PatternThumbnail resolves null and rotted links to the fallback.
              thumbnailUrl: p.thumbnail_url,
              favoriteCount: p._count.favorites,
            }))}
          />

          <CommunityCallout />
        </div>
      </div>
    </div>
  )
}
