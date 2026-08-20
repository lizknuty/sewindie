"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Plus, Search, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react"
import AudiencesTable from "./components/AudiencesTable"
import AudiencesGrid from "./components/AudiencesGrid"
import type { AdminAudience } from "./types"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<AdminAudience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sortValue, setSortValue] = useState("name_asc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  useEffect(() => {
    const fetchAudiences = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/audiences")
        if (!response.ok) throw new Error("Failed to fetch audiences")
        const data = await response.json()
        setAudiences(Array.isArray(data) ? data : [])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchAudiences()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
  }

  const filteredSorted = useMemo(() => {
    const q = query.toLowerCase()
    const filtered = q ? audiences.filter((a) => a.name.toLowerCase().includes(q)) : [...audiences]
    switch (sortValue) {
      case "name_desc":
        return filtered.sort((a, b) => b.name.localeCompare(a.name))
      case "patterns_desc":
        return filtered.sort((a, b) => (b._count?.PatternAudience ?? 0) - (a._count?.PatternAudience ?? 0))
      case "patterns_asc":
        return filtered.sort((a, b) => (a._count?.PatternAudience ?? 0) - (b._count?.PatternAudience ?? 0))
      case "name_asc":
      default:
        return filtered.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [audiences, query, sortValue])

  const totalAudiences = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalAudiences / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredSorted.slice(start, start + rowsPerPage)
  }, [filteredSorted, currentPage, rowsPerPage])

  const rangeStart = totalAudiences === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalAudiences)

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
          <h1 className="patterns-title">Audiences</h1>
          <p className="patterns-subtitle">Group patterns by their intended audience.</p>
        </div>
        <Link href="/admin/audiences/new" className="btn-add-pattern">
          <Plus size={18} />
          Add Audience
        </Link>
      </header>

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search audiences by name..."
            aria-label="Search audiences"
          />
        </form>

        <div className="patterns-sort">
          <label htmlFor="sort-select">Sort by:</label>
          <select
            id="sort-select"
            value={sortValue}
            onChange={(e) => {
              setSortValue(e.target.value)
              setPage(1)
            }}
          >
            <option value="name_asc">Audience Name (A–Z)</option>
            <option value="name_desc">Audience Name (Z–A)</option>
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
            ? "Loading audiences..."
            : `Showing ${rangeStart}–${rangeEnd} of ${totalAudiences.toLocaleString()} audiences`}
        </span>
      </div>

      <div className="patterns-layout filters-hidden">
        <div className="patterns-content">
          {error ? (
            <div className="patterns-empty text-danger">Error: {error}</div>
          ) : loading ? (
            <div className="patterns-empty">Loading audiences...</div>
          ) : totalAudiences === 0 ? (
            <div className="patterns-empty">No audiences found.</div>
          ) : viewMode === "list" ? (
            <AudiencesTable audiences={paginated} />
          ) : (
            <AudiencesGrid audiences={paginated} />
          )}

          {!loading && !error && totalAudiences > 0 && (
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

              <nav className="pagination" aria-label="Audience pages">
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
