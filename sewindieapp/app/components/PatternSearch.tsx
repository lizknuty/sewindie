'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PatternSearchProps {
  initialSearch: string | string[];
}

const PatternSearch: React.FC<PatternSearchProps> = ({ initialSearch }) => {
  const [search, setSearch] = useState(Array.isArray(initialSearch) ? initialSearch[0] || '' : initialSearch)
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('search', search)
    router.push(currentUrl.toString())
  }

  return (
    <form onSubmit={handleSearch} className="mb-4 col-12 col-lg-3">
      <div className="input-group">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search patterns or designers..."
          className="form-control rounded-pill me-2"
        />
        <button
          type="submit"
          className="btn btn-primary hero-btn rounded-pill"
        >
          Search
        </button>
      </div>
    </form>
  )
}

export default PatternSearch