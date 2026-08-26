import { prisma } from "@/lib/prisma"
import { PATTERN_SLOTS, getFeaturedDesigners, inIdOrder, pinnedFirst } from "@/lib/homepage-rails"
import HomeHero from "./components/HomeHero"
import FeaturedDesigners from "./components/FeaturedDesigners"
import NewNoteworthyPatterns from "./components/NewNoteworthyPatterns"
import CommunityCallout from "./components/CommunityCallout"

const PATTERN_CARD = {
  id: true,
  name: true,
  thumbnail_url: true,
  designer: { select: { name: true } },
  _count: { select: { favorites: true } },
} as const

export default async function Home() {
  // The designer rail now comes from a shared helper so /designers can render
  // the identical rail; the pattern rail is still assembled here because it is
  // the only page that shows it.
  const pinnedPatternRows = await prisma.featuredPattern.findMany({
    orderBy: { position: "asc" },
    select: { pattern_id: true },
  })
  const pinnedPatternIds = pinnedPatternRows.map((row) => row.pattern_id)

  const [featuredDesigners, pinnedPatterns, autoPatterns] = await Promise.all([
    getFeaturedDesigners(),
    pinnedPatternIds.length
      ? prisma.pattern.findMany({ where: { id: { in: pinnedPatternIds } }, select: PATTERN_CARD })
      : Promise.resolve([]),
    prisma.pattern.findMany({
      take: PATTERN_SLOTS + pinnedPatternIds.length,
      select: PATTERN_CARD,
      orderBy: { id: "desc" },
    }),
  ])

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
          <FeaturedDesigners designers={featuredDesigners} />

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
