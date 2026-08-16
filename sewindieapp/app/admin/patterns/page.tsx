"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Plus, Search, SlidersHorizontal, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react"
import AdminPatternFilters from "./components/AdminPatternFilters"
import PatternsTable from "./components/PatternsTable"
import PatternsGrid from "./components/PatternsGrid"
import type { AdminPattern } from "./types"

type FilterOption = {
  id: number
  name: string
}

const FILTER_KEYS = ["category", "attribute", "format", "audience", "fabricType", "designer", "status"]
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export default function PatternsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [patterns, setPatterns] = useState<AdminPattern[]>([])
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [attributes, setAttributes] = useState<FilterOption[]>([])
  const [formats, setFormats] = useState<FilterOption[]>([])
  const [audiences, setAudiences] = useState<FilterOption[]>([])
  const [fabricTypes, setFabricTypes] = useState<FilterOption[]>([])
  const [designers, setDesigners] = useState<FilterOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [showFilters, setShowFilters] = useState(true)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const sortValue = searchParams.get("sort") || "name_asc"

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "")
    setPage(1)
  }, [searchParams])

  useEffect(() => {
    const fetchPatternsAndFilters = async () => {
      setLoading(true)
      setError(null)
      try {
        const patternsResponse = await fetch(`/api/patterns?${searchParams.toString()}`)
        if (!patternsResponse.ok) throw new Error("Failed to fetch patterns")
        const patternsData = await patternsResponse.json()
        setPatterns(patternsData.patterns)

        const [categoriesRes, attributesRes, formatsRes, audiencesRes, fabricTypesRes, designersRes] =
          await Promise.all([
            fetch("/api/categories"),
            fetch("/api/attributes"),
            fetch("/api/formats"),
            fetch("/api/audiences"),
            fetch("/api/fabric-types"),
            fetch("/api/designers"),
          ])
        const [categoriesData, attributesData, formatsData, audiencesData, fabricTypesData, designersData] =
          await Promise.all([
            categoriesRes.json(),
            attributesRes.json(),
            formatsRes.json(),
            audiencesRes.json(),
            fabricTypesRes.json(),
            designersRes.json(),
          ])
        setCategories(categoriesData.categories || categoriesData)
        setAttributes(attributesData.attributes || attributesData)
        setFormats(formatsData.formats || formatsData)
        setAudiences(audiencesData.audiences || audiencesData)
        setFabricTypes(fabricTypesData.fabricTypes || fabricTypesData)
        setDesigners(designersData.designers || designersData)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchPatternsAndFilters()
  }, [searchParams])

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateParam("search", searchInput.trim())
  }

  const activeFilterCount = FILTER_KEYS.filter((k) => searchParams.has(k)).length

  const totalPatterns = patterns.length
  const totalPages = Math.max(1, Math.ceil(totalPatterns / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return patterns.slice(start, start + rowsPerPage)
  }, [patterns, currentPage, rowsPerPage])

  const rangeStart = totalPatterns === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalPatterns)

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    const maxToShow = 3
    if (totalPages <= maxToShow + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      for (let i = 1; i <= Math.min(maxToShow, totalPages - 1); i++) pages.push(i)
      if (currentPage > maxToShow && currentPage < totalPages) {
        pages.push("ellipsis", currentPage)
      } else {
        pages.push("ellipsis")
      }
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, currentPage])

  return (
    <div className="admin-patterns-page">
      <header className="patterns-page-header">
        <div>
          <h1 className="patterns-title">Patterns</h1>
          <p className="patterns-subtitle">Browse, search, and manage all patterns in the directory.</p>
        </div>
        <Link href="/admin/patterns/new" className="btn-add-pattern">
          <Plus size={18} />
          Add Pattern
        </Link>
      </header>

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search patterns by name, designer, or keyword..."
            aria-label="Search patterns"
          />
        </form>

        <button
          type="button"
          className={`filters-toggle-btn ${showFilters ? "is-active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          Filters
          <span className="filters-count">{activeFilterCount}</span>
        </button>

        <div className="patterns-sort">
          <label htmlFor="sort-select">Sort by:</label>
          <select id="sort-select" value={sortValue} onChange={(e) => updateParam("sort", e.target.value)}>
            <option value="name_asc">Pattern Name (A–Z)</option>
            <option value="name_desc">Pattern Name (Z–A)</option>
            <option value="designer_asc">Designer Name (A–Z)</option>
            <option value="designer_desc">Designer Name (Z–A)</option>
          </select>
        </div>

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewMode === "list" ? "is-active" : ""}
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List size={18} />
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      <div className="patterns-resultbar">
        <span className="patterns-count">
          {loading ? "Loading patterns..." : `Showing ${rangeStart}–${rangeEnd} of ${totalPatterns.toLocaleString()} patterns`}
        </span>
      </div>

      <div className={`patterns-layout ${showFilters ? "" : "filters-hidden"}`}>
        {showFilters && (
          <AdminPatternFilters
            categories={categories}
            attributes={attributes}
            formats={formats}
            audiences={audiences}
            fabricTypes={fabricTypes}
            designers={designers}
          />
        )}

        <div className="patterns-content">
          {error ? (
            <div className="patterns-empty text-danger">Error: {error}</div>
          ) : loading ? (
            <div className="patterns-empty">Loading patterns...</div>
          ) : totalPatterns === 0 ? (
            <div className="patterns-empty">No patterns found.</div>
          ) : viewMode === "list" ? (
            <PatternsTable patterns={paginated} />
          ) : (
            <PatternsGrid patterns={paginated} />
          )}

          {!loading && !error && totalPatterns > 0 && (
            <div className="patterns-footer">
              <div className="rows-per-page">
                <label htmlFor="rows-select">Rows per page:</label>
                <select
                  id="rows-select"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {ROWS_PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <nav className="pagination" aria-label="Pattern pages">
                <button
                  type="button"
                  className="page-arrow"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageNumbers.map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`e-${i}`} className="page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={p}
                      className={`page-num ${p === currentPage ? "is-active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="page-arrow"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
