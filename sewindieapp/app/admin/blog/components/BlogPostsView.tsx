"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Search, List, LayoutGrid, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import BlogPostsTable from "./BlogPostsTable"
import BlogPostsGrid from "./BlogPostsGrid"
import type { AdminBlogPost } from "@/admin/blog/types"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

type StatusFilter = "all" | "published" | "draft"

export default function BlogPostsView({ posts }: { posts: AdminBlogPost[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [sortValue, setSortValue] = useState("created_desc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const statusCounts = {
    all: posts.length,
    published: posts.filter((p) => p.published).length,
    draft: posts.filter((p) => !p.published).length,
  }

  const tabs: { key: StatusFilter; label: string; count: number; dot?: string }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "published", label: "Published", count: statusCounts.published, dot: "status-dot-published" },
    { key: "draft", label: "Drafts", count: statusCounts.draft, dot: "status-dot-draft" },
  ]

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
  }

  const filteredSorted = useMemo(() => {
    const q = query.toLowerCase()
    let list = posts

    if (filter !== "all") {
      list = list.filter((p) => (filter === "published" ? p.published : !p.published))
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.excerpt?.toLowerCase().includes(q) ?? false) ||
          (p.User?.name?.toLowerCase().includes(q) ?? false),
      )
    }

    const sorted = [...list]
    const time = (v: string | null) => (v ? new Date(v).getTime() : 0)

    switch (sortValue) {
      case "created_asc":
        return sorted.sort((a, b) => time(a.createdAt) - time(b.createdAt))
      case "updated_desc":
        return sorted.sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
      case "published_desc":
        return sorted.sort((a, b) => time(b.publishedAt) - time(a.publishedAt))
      case "title_asc":
        return sorted.sort((a, b) => a.title.localeCompare(b.title))
      case "title_desc":
        return sorted.sort((a, b) => b.title.localeCompare(a.title))
      case "created_desc":
      default:
        return sorted.sort((a, b) => time(b.createdAt) - time(a.createdAt))
    }
  }, [posts, filter, query, sortValue])

  const totalPosts = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalPosts / rowsPerPage))
  const currentPage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return filteredSorted.slice(start, start + rowsPerPage)
  }, [filteredSorted, currentPage, rowsPerPage])

  const rangeStart = totalPosts === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalPosts)

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
    <div>
      <div className="user-tabs" role="tablist" aria-label="Filter posts by status">
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
              <FileText size={16} className="user-tab-icon" />
            ) : (
              <span className={`status-dot ${tab.dot}`} aria-hidden="true" />
            )}
            <span>{tab.label}</span>
            <span className="user-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="patterns-toolbar">
        <form className="patterns-search" onSubmit={handleSearchSubmit}>
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search posts by title or author..."
            aria-label="Search blog posts"
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
            <option value="created_desc">Created (Newest)</option>
            <option value="created_asc">Created (Oldest)</option>
            <option value="updated_desc">Recently Updated</option>
            <option value="published_desc">Recently Published</option>
            <option value="title_asc">Title (A–Z)</option>
            <option value="title_desc">Title (Z–A)</option>
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
          {`Showing ${rangeStart}–${rangeEnd} of ${totalPosts.toLocaleString()} posts`}
        </span>
      </div>

      <div className="patterns-layout filters-hidden">
        <div className="patterns-content">
          {totalPosts === 0 ? (
            <div className="patterns-empty">
              {posts.length === 0 ? "No blog posts yet. Create your first post to get started." : "No posts found."}
            </div>
          ) : viewMode === "list" ? (
            <BlogPostsTable posts={paginated} />
          ) : (
            <BlogPostsGrid posts={paginated} />
          )}

          {totalPosts > 0 && (
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

              <nav className="pagination" aria-label="Blog post pages">
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
