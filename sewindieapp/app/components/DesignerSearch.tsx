"use client"

import type React from "react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface DesignerSearchProps {
  initialSearch: string | string[]
}

const DesignerSearch: React.FC<DesignerSearchProps> = ({ initialSearch }) => {
  const [search, setSearch] = useState(Array.isArray(initialSearch) ? initialSearch[0] || "" : initialSearch)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const currentParams = new URLSearchParams(searchParams.toString())
    if (search) {
      currentParams.set("search", search)
    } else {
      currentParams.delete("search")
    }
    router.push(`/admin/designers?${currentParams.toString()}`)
  }

  return (
    <form onSubmit={handleSearch} className="mb-4 col-12 col-lg-3">
      <div className="input-group">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search designers..."
          className="form-control rounded-pill me-2"
        />
        <button type="submit" className="btn btn-primary hero-btn rounded-pill">
          Search
        </button>
      </div>
    </form>
  )
}

export default DesignerSearch
