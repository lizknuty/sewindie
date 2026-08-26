"use client"

import { useState, useEffect } from "react"
import type React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"

export type DesignerSortOption = "name_asc" | "name_desc"

/**
 * Sort control for /designers.
 *
 * Separate from PatternSorter rather than a prop on it: that control offers
 * four pattern-specific orderings (pattern name / designer name), and a
 * designer list can only be sorted by its own name. Reuses the `.psort`
 * styling so the two toolbars look identical.
 */
export default function DesignerSorter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const initialSort = (searchParams.get("sort") as DesignerSortOption) || "name_asc"
  const [sortOption, setSortOption] = useState<DesignerSortOption>(initialSort)

  useEffect(() => {
    setSortOption((searchParams.get("sort") as DesignerSortOption) || "name_asc")
  }, [searchParams])

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as DesignerSortOption
    setSortOption(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", next)
    // Re-sorting reorders the whole result set, so the old page offset points
    // at unrelated rows -- go back to page 1.
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="psort">
      <label htmlFor="designer-sort-select" className="psort-label">
        Sort by
      </label>
      <select
        id="designer-sort-select"
        value={sortOption}
        onChange={handleSortChange}
        className="psort-select"
      >
        <option value="name_asc">Designer name (A-Z)</option>
        <option value="name_desc">Designer name (Z-A)</option>
      </select>
    </div>
  )
}
