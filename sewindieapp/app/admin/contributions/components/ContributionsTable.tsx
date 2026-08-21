"use client"

import type React from "react"
import { useMemo, useState } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  LayoutGrid,
  List,
  Inbox,
  Search,
  X,
} from "lucide-react"
import type { PatternContribution } from "@/lib/google-sheets"
import ContributionsListView from "./ContributionsListView"
import ContributionsGrid from "./ContributionsGrid"
import ContributionDetailsModal from "./ContributionDetailsModal"

interface ContributionsTableProps {
  initialContributions: PatternContribution[]
}

type StatusFilter = "all" | "Pending" | "Approved" | "Rejected" | "Imported"
type SortOption = "name_asc" | "name_desc" | "designer_asc" | "newest"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

const normalizeStatus = (status?: string) => status?.trim() || "Pending"

export default function ContributionsTable({ initialContributions }: ContributionsTableProps) {
  const [contributions, setContributions] = useState(initialContributions)
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({})
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("newest")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [detailsFor, setDetailsFor] = useState<PatternContribution | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const statusCounts = useMemo(
    () => ({
      all: contributions.length,
      Pending: contributions.filter((c) => normalizeStatus(c.status) === "Pending").length,
      Approved: contributions.filter((c) => normalizeStatus(c.status) === "Approved").length,
      Rejected: contributions.filter((c) => normalizeStatus(c.status) === "Rejected").length,
      Imported: contributions.filter((c) => normalizeStatus(c.status) === "Imported").length,
    }),
    [contributions],
  )

  const tabs: { key: StatusFilter; label: string; count: number; dot?: string }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "Pending", label: "Pending", count: statusCounts.Pending, dot: "status-dot-pending" },
    { key: "Approved", label: "Approved", count: statusCounts.Approved, dot: "status-dot-active" },
    { key: "Rejected", label: "Rejected", count: statusCounts.Rejected, dot: "status-dot-suspended" },
    { key: "Imported", label: "Imported", count: statusCounts.Imported, dot: "status-dot-imported" },
  ]

  const filteredSorted = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    let list = contributions.filter((c) => filter === "all" || normalizeStatus(c.status) === filter)

    if (q) {
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.designer?.toLowerCase().includes(q) ||
          c.categories?.toLowerCase().includes(q),
      )
    }

    const sorted = [...list]
    switch (sortOption) {
      case "name_asc":
        return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      case "name_desc":
        return sorted.sort((a, b) => (b.name || "").localeCompare(a.name || ""))
      case "designer_asc":
        return sorted.sort((a, b) => (a.designer || "").localeCompare(b.designer || ""))
      case "newest":
      default:
        return sorted.sort((a, b) => b.rowIndex - a.rowIndex)
    }
  }, [contributions, filter, searchInput, sortOption])

  const totalContributions = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalContributions / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredSorted.slice(start, start + rowsPerPage)
  }, [filteredSorted, currentPage, rowsPerPage])

  const rangeStart = totalContributions === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalContributions)

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

  const updateStatus = async (rowIndex: number, status: string) => {
    setIsLoading((prev) => ({ ...prev, [rowIndex]: true }))
    setFeedback(null)

    try {
      const response = await fetch("/api/admin/contributions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, status }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      setContributions((prev) => prev.map((c) => (c.rowIndex === rowIndex ? { ...c, status } : c)))
      setFeedback({ type: "success", message: `Contribution marked as ${status.toLowerCase()}.` })
    } catch (error) {
      console.error("Error updating contribution status:", error)
      setFeedback({ type: "error", message: "Failed to update status. Please try again." })
    } finally {
      setIsLoading((prev) => ({ ...prev, [rowIndex]: false }))
    }
  }

  const importContribution = async (contribution: PatternContribution) => {
    setIsLoading((prev) => ({ ...prev, [contribution.rowIndex]: true }))
    setFeedback(null)

    try {
      const response = await fetch("/api/admin/contributions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contribution }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to import contribution")
      }

      setContributions((prev) =>
        prev.map((c) => (c.rowIndex === contribution.rowIndex ? { ...c, status: "Imported" } : c)),
      )
      setFeedback({ type: "success", message: `"${contribution.name}" was imported as a pattern.` })
    } catch (error) {
      console.error("Error importing contribution:", error)
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to import contribution. Please try again.",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, [contribution.rowIndex]: false }))
    }
  }

  const renderActions = (contribution: PatternContribution) => {
    const status = normalizeStatus(contribution.status)
    const busy = isLoading[contribution.rowIndex]

    return (
      <>
        <button
          type="button"
          className="action-icon-btn"
          onClick={() => setDetailsFor(contribution)}
          title="View details"
          aria-label={`View details for ${contribution.name || "contribution"}`}
        >
          <Eye size={16} />
        </button>

        {status === "Pending" && (
          <>
            <button
              type="button"
              className="action-icon-btn action-approve"
              onClick={() => updateStatus(contribution.rowIndex, "Approved")}
              disabled={busy}
              title="Approve"
              aria-label={`Approve ${contribution.name || "contribution"}`}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              className="action-icon-btn action-reject"
              onClick={() => updateStatus(contribution.rowIndex, "Rejected")}
              disabled={busy}
              title="Reject"
              aria-label={`Reject ${contribution.name || "contribution"}`}
            >
              <X size={16} />
            </button>
          </>
        )}

        {(status === "Approved" || status === "Pending") && (
          <button
            type="button"
            className="action-icon-btn action-import"
            onClick={() => importContribution(contribution)}
            disabled={busy}
            title="Import as pattern"
            aria-label={`Import ${contribution.name || "contribution"} as a pattern`}
          >
            <Download size={16} />
          </button>
        )}
      </>
    )
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  return (
    <div>
      {/* Status tabs */}
      <div className="user-tabs" role="tablist" aria-label="Filter contributions by status">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            className={`user-tab ${filter === tab.key ? "is-active" : ""}`}
            onClick={() => {
              setFilter(tab.key)
              setPage(1)
            }}
          >
            {tab.key === "all" ? (
              <Inbox size={16} className="user-tab-icon" />
            ) : (
              <span className={`status-dot ${tab.dot}`} aria-hidden="true" />
            )}
            <span>{tab.label}</span>
            <span className="user-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search by pattern, designer, or category..."
            aria-label="Search contributions"
          />
        </form>

        <div className="patterns-sort">
          <label htmlFor="contribution-sort">Sort by:</label>
          <select
            id="contribution-sort"
            value={sortOption}
            onChange={(e) => {
              setSortOption(e.target.value as SortOption)
              setPage(1)
            }}
          >
            <option value="newest">Submitted (Newest)</option>
            <option value="name_asc">Pattern Name (A–Z)</option>
            <option value="name_desc">Pattern Name (Z–A)</option>
            <option value="designer_asc">Designer (A–Z)</option>
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

      {feedback && (
        <div className={`contribution-feedback ${feedback.type === "error" ? "is-error" : "is-success"}`} role="status">
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="patterns-resultbar">
        <span className="patterns-count">
          {`Showing ${rangeStart}–${rangeEnd} of ${totalContributions.toLocaleString()} contributions`}
        </span>
      </div>

      <div className="patterns-layout filters-hidden">
        <div className="patterns-content">
          {totalContributions === 0 ? (
            <div className="patterns-empty">No contributions found.</div>
          ) : viewMode === "list" ? (
            <ContributionsListView contributions={paginated} renderActions={renderActions} />
          ) : (
            <ContributionsGrid contributions={paginated} renderActions={renderActions} />
          )}

          {totalContributions > 0 && (
            <div className="patterns-footer">
              <div className="rows-per-page">
                <label htmlFor="contribution-rows">Rows per page:</label>
                <select
                  id="contribution-rows"
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

              <nav className="pagination" aria-label="Contribution pages">
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

      {detailsFor && <ContributionDetailsModal contribution={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  )
}
