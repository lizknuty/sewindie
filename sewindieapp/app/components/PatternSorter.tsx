"use client"
import { useState, useEffect } from "react"
import type React from "react"

import { useRouter, useSearchParams, usePathname } from "next/navigation"

type SortOption = "name_asc" | "name_desc" | "designer_asc" | "designer_desc"

export default function PatternSorter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Sorting must stay on whichever route rendered this control. It previously
  // hardcoded /admin/patterns, which sent public visitors into the admin area.
  const pathname = usePathname()
  const initialSort = (searchParams.get("sort") as SortOption) || "name_asc"
  const [sortOption, setSortOption] = useState<SortOption>(initialSort)

  useEffect(() => {
    setSortOption((searchParams.get("sort") as SortOption) || "name_asc")
  }, [searchParams])

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortOption = e.target.value as SortOption
    setSortOption(newSortOption)
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set("sort", newSortOption)
    // Re-sorting reorders the whole result set, so page 2 of the old order is
    // meaningless — return to the first page.
    currentParams.delete("page")
    router.push(`${pathname}?${currentParams.toString()}`)
  }

  return (
    <div className="psort">
      <label htmlFor="sort-select" className="psort-label">
        Sort by
      </label>
      <select id="sort-select" value={sortOption} onChange={handleSortChange} className="psort-select">
        <option value="name_asc">Pattern name (A-Z)</option>
        <option value="name_desc">Pattern name (Z-A)</option>
        <option value="designer_asc">Designer name (A-Z)</option>
        <option value="designer_desc">Designer name (Z-A)</option>
      </select>
    </div>
  )
}
