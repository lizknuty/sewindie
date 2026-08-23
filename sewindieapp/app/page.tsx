import { prisma } from "@/lib/prisma"
import HomeHero from "./components/HomeHero"
import FeaturedDesigners from "./components/FeaturedDesigners"
import NewNoteworthyPatterns from "./components/NewNoteworthyPatterns"
import CommunityCallout from "./components/CommunityCallout"

export default async function Home() {
  // Both rails are independent, so overlap the round trips.
  const [featuredDesigners, featuredPatterns] = await Promise.all([
    prisma.designer.findMany({
      take: 10,
      select: { id: true, name: true, logo_url: true },
      orderBy: { patterns: { _count: "desc" } },
    }),
    prisma.pattern.findMany({
      take: 12,
      select: {
        id: true,
        name: true,
        thumbnail_url: true,
        designer: { select: { name: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: { id: "desc" },
    }),
  ])

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
