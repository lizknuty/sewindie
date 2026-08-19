"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Plus, Search, SlidersHorizontal, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react"
import AdminDesignerFilters from "./components/AdminDesignerFilters"
import DesignersTable from "./components/DesignersTable"
import DesignersGrid from "./components/DesignersGrid"
import type { AdminDesigner } from "./types"

const FILTER_KEYS = ["status"]
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export default function DesignersPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [designers, setDesigners] = useState<AdminDesigner[]>([])
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
    const fetchDesigners = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("sort")
        const response = await fetch(`/api/designers?${params.toString()}`)
        if (!response.ok) throw new Error("Failed to fetch designers")
        const data = await response.json()
        setDesigners(data.designers || [])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchDesigners()
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

  const sortedDesigners = useMemo(() => {
    const copy = [...designers]
    switch (sortValue) {
      case "name_desc":
        return copy.sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""))
      case "patterns_desc":
        return copy.sort((a, b) => (b._count?.patterns ?? 0) - (a._count?.patterns ?? 0))
      case "patterns_asc":
        return copy.sort((a, b) => (a._count?.patterns ?? 0) - (b._count?.patterns ?? 0))
      case "name_asc":
      default:
        return copy.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
    }
  }, [designers, sortValue])

  const totalDesigners = sortedDesigners.length
  const totalPages = Math.max(1, Math.ceil(totalDesigners / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return sortedDesigners.slice(start, start + rowsPerPage)
  }, [sortedDesigners, currentPage, rowsPerPage])

  const rangeStart = totalDesigners === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalDesigners)

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
          <h1 className="patterns-title">Designers</h1>
          <p className="patterns-subtitle">Browse, search, and manage all designers in the directory.</p>
        </div>
        <Link href="/admin/designers/new" className="btn-add-pattern">
          <Plus size={18} />
          Add Designer
        </Link>
      </header>

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search designers by name or keyword..."
            aria-label="Search designers"
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
            <option value="name_asc">Designer Name (A–Z)</option>
            <option value="name_desc">Designer Name (Z–A)</option>
            <option value="patterns_desc">Most Patterns</option>
            <option value="patterns_asc">Fewest Patterns</option>
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
          {loading
            ? "Loading designers..."
            : `Showing ${rangeStart}–${rangeEnd} of ${totalDesigners.toLocaleString()} designers`}
        </span>
      </div>

      <div className={`patterns-layout ${showFilters ? "" : "filters-hidden"}`}>
        {showFilters && <AdminDesignerFilters />}

        <div className="patterns-content">
          {error ? (
            <div className="patterns-empty text-danger">Error: {error}</div>
          ) : loading ? (
            <div className="patterns-empty">Loading designers...</div>
          ) : totalDesigners === 0 ? (
            <div className="patterns-empty">No designers found.</div>
          ) : viewMode === "list" ? (
            <DesignersTable designers={paginated} />
          ) : (
            <DesignersGrid designers={paginated} />
          )}

          {!loading && !error && totalDesigners > 0 && (
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

              <nav className="pagination" aria-label="Designer pages">
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
