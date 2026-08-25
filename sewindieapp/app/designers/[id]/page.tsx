import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import PatternCard from "@/components/PatternCard"
import PatternListRow from "@/components/PatternListRow"
import PatternSorter from "@/components/PatternSorter"
import PatternViewToggle from "@/components/PatternViewToggle"
import PaginationControls from "@/components/PaginationControls"
import CollectionCard from "@/components/CollectionCard"
import DesignerHero from "./components/DesignerHero"
import DesignerStats from "./components/DesignerStats"
import DesignerTabs, { DESIGNER_TABS, type DesignerTab } from "./components/DesignerTabs"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const ITEMS_PER_PAGE = 12

/** Placeholder until designers fill in the `about` column. */
const ABOUT_PLACEHOLDER = [
  "This designer has not added an About section yet.",
  "Once they do, you will find their story here — how they started drafting patterns, the fits and silhouettes they specialise in, and the sewists they design for.",
]

const SORT_MAP = {
  name_asc: { name: "asc" as const },
  name_desc: { name: "desc" as const },
  designer_asc: { name: "asc" as const },
  designer_desc: { name: "desc" as const },
}

function readTab(raw: string | string[] | undefined): DesignerTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  return DESIGNER_TABS.includes(value as DesignerTab) ? (value as DesignerTab) : "patterns"
}

export default async function DesignerPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams

  const designerId = Number.parseInt(id, 10)
  if (Number.isNaN(designerId)) {
    notFound()
  }

  const tab = readTab(resolvedSearchParams.tab)
  const view = resolvedSearchParams.view === "list" ? "list" : "grid"
  const page = Math.max(1, Number(resolvedSearchParams.page) || 1)
  const sortKey = (Array.isArray(resolvedSearchParams.sort)
    ? resolvedSearchParams.sort[0]
    : resolvedSearchParams.sort) as keyof typeof SORT_MAP | undefined
  // Designer sorts are meaningless here (every result shares one designer), so
  // anything unrecognised falls back to name A-Z.
  const orderBy = SORT_MAP[sortKey ?? "name_asc"] ?? SORT_MAP.name_asc

  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
  })

  if (!designer) {
    notFound()
  }

  // Counts and the rating aggregate drive the stats bar, so they are needed on
  // every tab, not just the patterns list.
  const [totalPatterns, ratingAgg, collectionCount] = await Promise.all([
    prisma.pattern.count({ where: { designer_id: designerId } }),
    prisma.rating.aggregate({
      where: { pattern: { designer_id: designerId } },
      _avg: { score: true },
      _count: { score: true },
    }),
    // A collection counts for this designer when it is public and holds at
    // least one of their patterns.
    prisma.collection.count({
      where: {
        visibility: "PUBLIC",
        patterns: { some: { pattern: { designer_id: designerId } } },
      },
    }),
  ])

  const totalPages = Math.ceil(totalPatterns / ITEMS_PER_PAGE)

  // Only the active tab's list is queried, so switching tabs does not pay for
  // data it will not render.
  const patterns =
    tab === "patterns"
      ? await prisma.pattern.findMany({
          where: { designer_id: designerId },
          include: {
            designer: { select: { id: true, name: true } },
            PatternCategory: { include: { category: true } },
            PatternAudience: { include: { audience: true } },
            PatternFabricType: { include: { fabricType: true } },
          },
          orderBy,
          skip: (page - 1) * ITEMS_PER_PAGE,
          take: ITEMS_PER_PAGE,
        })
      : []

  const collections =
    tab === "collections"
      ? await prisma.collection.findMany({
          where: {
            visibility: "PUBLIC",
            patterns: { some: { pattern: { designer_id: designerId } } },
          },
          include: {
            user: { select: { name: true, username: true } },
            _count: { select: { patterns: true } },
            // Preview thumbnails are restricted to this designer's patterns so
            // the tab stays on-topic, per the agreed behaviour.
            patterns: {
              where: { pattern: { designer_id: designerId } },
              take: 4,
              orderBy: { addedAt: "desc" },
              include: {
                pattern: { select: { id: true, name: true, thumbnail_url: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 24,
        })
      : []

  // Counting matches per collection needs a second pass because the `patterns`
  // include above is capped at four for previews.
  const matchCounts =
    tab === "collections" && collections.length > 0
      ? await prisma.collectionPattern.groupBy({
          by: ["collectionId"],
          where: {
            collectionId: { in: collections.map((c) => c.id) },
            pattern: { designer_id: designerId },
          },
          _count: { patternId: true },
        })
      : []

  const matchCountByCollection = new Map(
    matchCounts.map((m) => [m.collectionId, m._count.patternId]),
  )

  const averageRating = ratingAgg._avg.score ?? null
  const ratingCount = ratingAgg._count.score

  return (
    <div className="designer-page">
      <DesignerHero
        name={designer.name}
        tagline={designer.tagline}
        logo_url={designer.logo_url}
        url={designer.url}
        facebook={designer.facebook}
        instagram={designer.instagram}
        pinterest={designer.pinterest}
        youtube={designer.youtube}
      />

      <div className="designer-shell">
        <DesignerStats
          address={designer.address}
          patternCount={totalPatterns}
          collectionCount={collectionCount}
          averageRating={averageRating}
          ratingCount={ratingCount}
        />

        <DesignerTabs designerId={designerId} active={tab} />

        {tab === "patterns" && (
          <section className="dpanel" aria-label="Patterns">
            <div className="dpanel-head">
              <h2 className="dpanel-title">All Patterns</h2>
              {totalPatterns > 0 && (
                <div className="dpanel-controls">
                  <PatternSorter />
                  <PatternViewToggle view={view} />
                </div>
              )}
            </div>

            {patterns.length === 0 ? (
              <div className="dempty">
                <p className="dempty-title">No patterns yet</p>
                <p className="dempty-text">
                  This designer does not have any patterns listed on SewIndie yet.
                </p>
              </div>
            ) : (
              <>
                {view === "list" ? (
                  <div className="prow-list">
                    {patterns.map((pattern) => (
                      <PatternListRow
                        key={pattern.id}
                        id={pattern.id}
                        name={pattern.name}
                        thumbnail_url={pattern.thumbnail_url}
                        designer={pattern.designer}
                        categories={pattern.PatternCategory.map((pc) => pc.category)}
                        fabricTypes={pattern.PatternFabricType.map((pf) => pf.fabricType)}
                        audiences={pattern.PatternAudience.map((pa) => pa.audience)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="pcard-grid">
                    {patterns.map((pattern) => (
                      <PatternCard
                        key={pattern.id}
                        id={pattern.id}
                        name={pattern.name}
                        thumbnail_url={pattern.thumbnail_url}
                        designer={pattern.designer}
                        patternCategories={pattern.PatternCategory}
                      />
                    ))}
                  </div>
                )}

                <div className="dpager-row">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    perPage={ITEMS_PER_PAGE}
                    totalItems={totalPatterns}
                    basePath={`/designers/${designerId}`}
                  />
                </div>
              </>
            )}
          </section>
        )}

        {tab === "collections" && (
          <section className="dpanel" aria-label="Collections">
            <div className="dpanel-head">
              <h2 className="dpanel-title">Public Collections</h2>
            </div>

            {collections.length === 0 ? (
              <div className="dempty">
                <p className="dempty-title">No public collections yet</p>
                <p className="dempty-text">
                  When sewists add {designer.name} patterns to a public collection, it will show up
                  here.
                </p>
              </div>
            ) : (
              <div className="ccard-grid">
                {collections.map((collection) => {
                  const matches = matchCountByCollection.get(collection.id) ?? 0
                  return (
                    <CollectionCard
                      key={collection.id}
                      id={collection.id}
                      name={collection.name}
                      description={collection.description}
                      patternCount={collection._count.patterns}
                      ownerName={collection.user.name || collection.user.username}
                      matchLabel={`${matches} from ${designer.name}`}
                      previews={collection.patterns.map((cp) => cp.pattern)}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )}

        {tab === "about" && (
          <section className="dpanel" aria-label="About">
            <div className="dpanel-head">
              <h2 className="dpanel-title">About {designer.name}</h2>
            </div>
            <div className="dprose">
              {designer.about?.trim() ? (
                designer.about
                  .split(/\n{2,}/)
                  .map((para, i) => <p key={i}>{para}</p>)
              ) : (
                ABOUT_PLACEHOLDER.map((para, i) => <p key={i}>{para}</p>)
              )}
            </div>
          </section>
        )}

        {tab === "reviews" && (
          <section className="dpanel" aria-label="Reviews">
            <div className="dpanel-head">
              <h2 className="dpanel-title">Reviews</h2>
            </div>
            <div className="dprose">
              {averageRating === null ? (
                <p>
                  No one has rated a {designer.name} pattern yet. Ratings left on individual patterns
                  will be summarised here.
                </p>
              ) : (
                <p>
                  {designer.name} patterns average{" "}
                  <strong>{averageRating.toFixed(1)} out of 5</strong> across{" "}
                  {ratingCount.toLocaleString()} {ratingCount === 1 ? "rating" : "ratings"}.
                </p>
              )}
              <p>
                Written reviews are coming soon. For now, ratings live on each pattern page — open a
                pattern to leave yours.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
