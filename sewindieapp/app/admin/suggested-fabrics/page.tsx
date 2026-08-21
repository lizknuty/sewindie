"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Plus, Search, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react"
import SuggestedFabricsTable from "./components/SuggestedFabricsTable"
import SuggestedFabricsGrid from "./components/SuggestedFabricsGrid"
import type { AdminSuggestedFabric } from "./types"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export default function SuggestedFabricsPage() {
  const [suggestedFabrics, setSuggestedFabrics] = useState<AdminSuggestedFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sortValue, setSortValue] = useState("name_asc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  useEffect(() => {
    const fetchSuggestedFabrics = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/suggested-fabrics")
        if (!response.ok) throw new Error("Failed to fetch suggested fabrics")
        const data = await response.json()
        setSuggestedFabrics(Array.isArray(data?.suggestedFabrics) ? data.suggestedFabrics : [])
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    fetchSuggestedFabrics()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
  }

  const filteredSorted = useMemo(() => {
    const q = query.toLowerCase()
    const filtered = q ? suggestedFabrics.filter((f) => f.name.toLowerCase().includes(q)) : [...suggestedFabrics]
    switch (sortValue) {
      case "name_desc":
        return filtered.sort((a, b) => b.name.localeCompare(a.name))
      case "patterns_desc":
        return filtered.sort(
          (a, b) => (b._count?.PatternSuggestedFabric ?? 0) - (a._count?.PatternSuggestedFabric ?? 0),
        )
      case "patterns_asc":
        return filtered.sort(
          (a, b) => (a._count?.PatternSuggestedFabric ?? 0) - (b._count?.PatternSuggestedFabric ?? 0),
        )
      case "name_asc":
      default:
        return filtered.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [suggestedFabrics, query, sortValue])

  const totalFabrics = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalFabrics / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredSorted.slice(start, start + rowsPerPage)
  }, [filteredSorted, currentPage, rowsPerPage])

  const rangeStart = totalFabrics === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalFabrics)

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
          <h1 className="patterns-title">Suggested Fabrics</h1>
          <p className="patterns-subtitle">Manage suggested fabrics that can be linked to patterns.</p>
        </div>
        <Link href="/admin/suggested-fabrics/new" className="btn-add-pattern">
          <Plus size={18} />
          Add Suggested Fabric
        </Link>
      </header>

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search suggested fabrics by name..."
            aria-label="Search suggested fabrics"
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
            <option value="name_asc">Fabric Name (A–Z)</option>
            <option value="name_desc">Fabric Name (Z–A)</option>
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
            ? "Loading suggested fabrics..."
            : `Showing ${rangeStart}–${rangeEnd} of ${totalFabrics.toLocaleString()} suggested fabrics`}
        </span>
      </div>

      <div className="patterns-layout filters-hidden">
        <div className="patterns-content">
          {error ? (
            <div className="patterns-empty text-danger">Error: {error}</div>
          ) : loading ? (
            <div className="patterns-empty">Loading suggested fabrics...</div>
          ) : totalFabrics === 0 ? (
            <div className="patterns-empty">No suggested fabrics found.</div>
          ) : viewMode === "list" ? (
            <SuggestedFabricsTable suggestedFabrics={paginated} />
          ) : (
            <SuggestedFabricsGrid suggestedFabrics={paginated} />
          )}

          {!loading && !error && totalFabrics > 0 && (
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

              <nav className="pagination" aria-label="Suggested fabric pages">
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
