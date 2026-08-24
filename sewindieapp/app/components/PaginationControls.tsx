"use client"

import React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  perPage: number
  totalItems: number
  basePath?: string
}

export default function PaginationControls({
  currentPage,
  totalPages,
  perPage,
  totalItems,
  basePath,
}: PaginationControlsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  // basePath used to default to '' , which pushed the query to the site root
  // whenever a caller omitted it. Falling back to the current route keeps
  // pagination on whatever page rendered it.
  const target = basePath || pathname

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`${target}?${params.toString()}`)
  }

  // A single page of results needs no controls.
  if (totalPages <= 1) return null

  return (
    <nav className="pager" aria-label="Pagination">
      <button
        type="button"
        className="pager-btn"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft size={15} aria-hidden="true" />
        Previous
      </button>
      {/* aria-live so paging announces the new position to screen readers. */}
      <span className="pager-status" aria-live="polite">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        className="pager-btn"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    </nav>
  )
}
