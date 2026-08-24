"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search } from "lucide-react"

interface PatternSearchProps {
  initialSearch: string | string[]
}

const PatternSearch: React.FC<PatternSearchProps> = ({ initialSearch }) => {
  const [search, setSearch] = useState(Array.isArray(initialSearch) ? initialSearch[0] || "" : initialSearch)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Build from the current params so an active search keeps the selected
    // filters instead of resetting them.
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = search.trim()
    if (trimmed) {
      params.set("search", trimmed)
    } else {
      params.delete("search")
    }
    // A new query changes the result set, so any page offset is stale.
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <form onSubmit={handleSearch} className="pattern-search" role="search">
      <label htmlFor="pattern-search-input" className="sr-only">
        Search patterns or designers
      </label>
      <input
        id="pattern-search-input"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patterns or designers..."
        className="pattern-search-input"
      />
      <button type="submit" className="pattern-search-btn">
        <Search size={15} aria-hidden="true" />
        Search
      </button>
    </form>
  )
}

export default PatternSearch
