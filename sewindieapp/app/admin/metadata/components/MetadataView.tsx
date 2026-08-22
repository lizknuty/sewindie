"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, List, LayoutGrid, ChevronLeft, ChevronRight } from "lucide-react"
import { METADATA_TABS, getTab, type MetadataTabKey } from "../config"
import type { MetadataItem } from "../types"
import type { AdminSizeChart } from "@/admin/size-charts/types"
import MetadataTabs from "./MetadataTabs"
import MetadataTable from "./MetadataTable"
import MetadataGrid from "./MetadataGrid"
import AddMetadataButton from "./AddMetadataButton"
import SizeChartsTable from "@/admin/size-charts/components/SizeChartsTable"
import SizeChartsGrid from "@/admin/size-charts/components/SizeChartsGrid"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

type ItemsByTab = Partial<Record<MetadataTabKey, MetadataItem[]>>

export default function MetadataView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = getTab(searchParams.get("tab"))

  const [itemsByTab, setItemsByTab] = useState<ItemsByTab>({})
  const [sizeCharts, setSizeCharts] = useState<AdminSizeChart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sortValue, setSortValue] = useState("name_asc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Load every dataset once so the tab badges show real counts immediately.
  useEffect(() => {
    let cancelled = false

    const loadAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const results = await Promise.all(
          METADATA_TABS.map(async (tab) => {
            const res = await fetch(tab.apiPath)
            if (!res.ok) throw new Error(`Failed to load ${tab.label.toLowerCase()}`)
            const json = await res.json()
            const raw = tab.responseKey ? json?.[tab.responseKey] : json
            return { tab, rows: Array.isArray(raw) ? raw : [] }
          }),
        )
        if (cancelled) return

        const next: ItemsByTab = {}
        for (const { tab, rows } of results) {
          if (tab.key === "size-charts") {
            setSizeCharts(rows as AdminSizeChart[])
            continue
          }
          next[tab.key] = rows.map((row: Record<string, any>) => ({
            id: row.id,
            name: row.name,
            patternCount: row._count?.[tab.countKey] ?? 0,
          }))
        }
        setItemsByTab(next)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const result: Partial<Record<MetadataTabKey, number>> = {}
    if (loading) return result
    for (const tab of METADATA_TABS) {
      result[tab.key] = tab.key === "size-charts" ? sizeCharts.length : (itemsByTab[tab.key]?.length ?? 0)
    }
    return result
  }, [itemsByTab, sizeCharts, loading])

  const handleTabChange = useCallback(
    (key: MetadataTabKey) => {
      // Reset per-tab view state, then reflect the tab in the URL.
      setSearchInput("")
      setQuery("")
      setSortValue(key === "size-charts" ? "label_asc" : "name_asc")
      setPage(1)
      router.replace(`/admin/metadata?tab=${key}`, { scroll: false })
    },
    [router],
  )

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
  }

  const isSizeCharts = activeTab.key === "size-charts"

  const filteredItems = useMemo(() => {
    if (isSizeCharts) return []
    const rows = itemsByTab[activeTab.key] ?? []
    const q = query.toLowerCase()
    const filtered = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows]
    switch (sortValue) {
      case "name_desc":
        return filtered.sort((a, b) => b.name.localeCompare(a.name))
      case "patterns_desc":
        return filtered.sort((a, b) => b.patternCount - a.patternCount)
      case "patterns_asc":
        return filtered.sort((a, b) => a.patternCount - b.patternCount)
      case "name_asc":
      default:
        return filtered.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [isSizeCharts, itemsByTab, activeTab.key, query, sortValue])

  const filteredCharts = useMemo(() => {
    if (!isSizeCharts) return []
    const q = query.toLowerCase()
    const filtered = q
      ? sizeCharts.filter(
          (c) => c.label.toLowerCase().includes(q) || (c.Designer?.name ?? "").toLowerCase().includes(q),
        )
      : [...sizeCharts]
    switch (sortValue) {
      case "label_desc":
        return filtered.sort((a, b) => b.label.localeCompare(a.label))
      case "designer_asc":
        return filtered.sort((a, b) => (a.Designer?.name ?? "").localeCompare(b.Designer?.name ?? ""))
      case "patterns_desc":
        return filtered.sort((a, b) => (b._count?.PatternSizeChart ?? 0) - (a._count?.PatternSizeChart ?? 0))
      case "label_asc":
      default:
        return filtered.sort((a, b) => a.label.localeCompare(b.label))
    }
  }, [isSizeCharts, sizeCharts, query, sortValue])

  const total = isSizeCharts ? filteredCharts.length : filteredItems.length
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * rowsPerPage

  const paginatedItems = useMemo(
    () => filteredItems.slice(start, start + rowsPerPage),
    [filteredItems, start, rowsPerPage],
  )
  const paginatedCharts = useMemo(
    () => filteredCharts.slice(start, start + rowsPerPage),
    [filteredCharts, start, rowsPerPage],
  )

  const rangeStart = total === 0 ? 0 : start + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, total)
  const plural = activeTab.label.toLowerCase()

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
          <h1 className="patterns-title">Pattern Metadata</h1>
          <p className="patterns-subtitle">Manage the controlled vocabulary used across patterns.</p>
        </div>
        <AddMetadataButton activeTab={activeTab} />
      </header>

      <MetadataTabs activeTab={activeTab.key} counts={counts} onChange={handleTabChange} />

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={isSizeCharts ? "Search size charts by label or designer..." : `Search ${plural}...`}
            aria-label={`Search ${plural}`}
          />
        </form>

        <div className="patterns-sort">
          <label htmlFor="metadata-sort">Sort by:</label>
          <select
            id="metadata-sort"
            value={sortValue}
            onChange={(e) => {
              setSortValue(e.target.value)
              setPage(1)
            }}
          >
            {isSizeCharts ? (
              <>
                <option value="label_asc">Label (A–Z)</option>
                <option value="label_desc">Label (Z–A)</option>
                <option value="designer_asc">Designer (A–Z)</option>
                <option value="patterns_desc">Most Patterns</option>
              </>
            ) : (
              <>
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
                <option value="patterns_desc">Most Patterns</option>
                <option value="patterns_asc">Fewest Patterns</option>
              </>
            )}
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
          {loading ? `Loading ${plural}...` : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()} ${plural}`}
        </span>
      </div>

      <div className="patterns-layout filters-hidden">
        <div className="patterns-content" id="metadata-panel" role="tabpanel" aria-labelledby={`metadata-tab-${activeTab.key}`}>
          {error ? (
            <div className="patterns-empty text-danger">Error: {error}</div>
          ) : loading ? (
            <div className="patterns-empty">Loading {plural}...</div>
          ) : total === 0 ? (
            <div className="patterns-empty">No {plural} found.</div>
          ) : isSizeCharts ? (
            viewMode === "list" ? (
              <SizeChartsTable sizeCharts={paginatedCharts} />
            ) : (
              <SizeChartsGrid sizeCharts={paginatedCharts} />
            )
          ) : viewMode === "list" ? (
            <MetadataTable
              items={paginatedItems}
              columnLabel={`${activeTab.singular} Name`}
              singular={activeTab.singular}
              basePath={activeTab.basePath}
            />
          ) : (
            <MetadataGrid
              items={paginatedItems}
              icon={activeTab.icon}
              singular={activeTab.singular}
              basePath={activeTab.basePath}
            />
          )}

          {!loading && !error && total > 0 && (
            <div className="patterns-footer">
              <div className="rows-per-page">
                <label htmlFor="metadata-rows">Rows per page:</label>
                <select
                  id="metadata-rows"
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

              <nav className="pagination" aria-label={`${activeTab.label} pages`}>
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
