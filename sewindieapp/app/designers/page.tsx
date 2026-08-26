import React from "react"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { getFeaturedDesigners } from "@/lib/homepage-rails"
import BrowseHero from "@/components/BrowseHero"
import FeaturedDesigners from "@/components/FeaturedDesigners"
import DesignerSorter from "@/components/DesignerSorter"
import DesignerCard from "@/components/DesignerCard"
import DesignerListRow from "@/components/DesignerListRow"
import PatternViewToggle from "@/components/PatternViewToggle"
import PaginationControls from "@/components/PaginationControls"

type ViewMode = "grid" | "list"
type SortOption = "name_asc" | "name_desc"

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/** Matches the mockup's 24-per-page rows-per-page default. */
const DEFAULT_PER_PAGE = 24

export default async function DesignersPage({ searchParams }: PageProps) {
  const resolved = await searchParams

  const search = typeof resolved.search === "string" ? resolved.search : ""
  const sort = (resolved.sort as SortOption) || "name_asc"
  const rawPage = Number.parseInt(typeof resolved.page === "string" ? resolved.page : "1", 10)
  const rawPerPage = Number.parseInt(
    typeof resolved.perPage === "string" ? resolved.perPage : String(DEFAULT_PER_PAGE),
    10,
  )
  // A malformed ?page=abc parses to NaN, which would make `skip` NaN and throw
  // at the database rather than just rendering page 1.
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const perPage = Number.isFinite(rawPerPage) && rawPerPage > 0 ? rawPerPage : DEFAULT_PER_PAGE
  // Anything other than an explicit 'list' falls back to grid, matching the
  // patterns page, so a malformed ?view= renders the default rather than nothing.
  const view: ViewMode = resolved.view === "list" ? "list" : "grid"

  const where = search ? { name: { contains: search, mode: "insensitive" as const } } : {}

  const orderBy = { name: sort === "name_desc" ? ("desc" as const) : ("asc" as const) }

  try {
    const [designers, totalDesigners, featured] = await Promise.all([
      prisma.designer.findMany({
        where,
        orderBy,
        select: {
          id: true,
          name: true,
          logo_url: true,
          _count: { select: { patterns: true } },
        },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.designer.count({ where }),
      getFeaturedDesigners(),
    ])

    const totalPages = Math.ceil(totalDesigners / perPage)

    return (
      <div className="designers-page">
        <BrowseHero
          title="Indie designers. Original patterns."
          lede="Explore unique designs and discover the makers behind them."
          initialSearch={search}
          searchPlaceholder="Search designers..."
          searchLabel="Search designers"
          searchInputId="designer-search-input"
          imageSrc="/patterns-hero.png"
        />

        <div className="designers-shell">
          {/* Same rail as the homepage, minus the "View all" -- it would point
              at this page. Hidden while searching, where a fixed editorial row
              is unrelated to what was typed. */}
          {!search && <FeaturedDesigners designers={featured} viewAllHref={null} />}

          <div className="designers-results">
            <div className="patterns-toolbar">
              <p className="patterns-count">
                {totalDesigners.toLocaleString()} {totalDesigners === 1 ? "designer" : "designers"}
              </p>
              <div className="patterns-toolbar-controls">
                <DesignerSorter />
                <PatternViewToggle view={view} />
              </div>
            </div>

            {designers.length === 0 ? (
              <div className="patterns-empty">
                <p className="patterns-empty-title">No designers match this search</p>
                <p className="patterns-empty-text">
                  Try a different spelling, or clear the search to browse everyone.
                </p>
              </div>
            ) : (
              <>
                {view === "list" ? (
                  <div className="drow-list">
                    {designers.map((designer) => (
                      <DesignerListRow
                        key={designer.id}
                        id={designer.id}
                        name={designer.name}
                        logo_url={designer.logo_url}
                        patternCount={designer._count.patterns}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dcard-grid">
                    {designers.map((designer) => (
                      <DesignerCard
                        key={designer.id}
                        id={designer.id}
                        name={designer.name}
                        logo_url={designer.logo_url}
                        patternCount={designer._count.patterns}
                      />
                    ))}
                  </div>
                )}

                <div className="patterns-pager-row">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    perPage={perPage}
                    totalItems={totalDesigners}
                    basePath="/designers"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error in DesignersPage:", error)
    return <div>An error occurred while loading the designers. Please try again later.</div>
  }
}

export const metadata: Metadata = {
  title: "Designers | SewIndie",
  description: "Browse independent sewing pattern designers and the patterns they make.",
}
