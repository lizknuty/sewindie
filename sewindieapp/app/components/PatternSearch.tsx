"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search } from "lucide-react"

interface PatternSearchProps {
  initialSearch: string | string[]
  /** Overridable so /designers can say "Search designers..." with the same control. */
  placeholder?: string
  label?: string
  inputId?: string
}

const PatternSearch: React.FC<PatternSearchProps> = ({
  initialSearch,
  placeholder = "Search patterns, designers, or keywords...",
  label = "Search patterns or designers",
  inputId = "pattern-search-input",
}) => {
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
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        className="pattern-search-input"
      />
      {/* Icon-only submit, so the accessible name comes from sr-only text
          rather than a visible label. */}
      <button type="submit" className="pattern-search-btn">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search</span>
      </button>
    </form>
  )
}

export default PatternSearch
