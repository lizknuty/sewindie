'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SortOption = 'name_asc' | 'name_desc' | 'designer_asc' | 'designer_desc'

export default function PatternSorter() {
  const router = useRouter()
  const [sortOption, setSortOption] = useState<SortOption>('name_asc')

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortOption = e.target.value as SortOption
    setSortOption(newSortOption)
    router.push(`/patterns?sort=${newSortOption}`)
  }

  return (
    <div className="mb-4">
      <label htmlFor="sort-select" className="me-2">Sort by:</label>
      <select
        id="sort-select"
        value={sortOption}
        onChange={handleSortChange}
        className="form-select form-select-sm d-inline-block w-auto"
      >
        <option value="name_asc">Pattern Name (A-Z)</option>
        <option value="name_desc">Pattern Name (Z-A)</option>
        <option value="designer_asc">Designer Name (A-Z)</option>
        <option value="designer_desc">Designer Name (Z-A)</option>
      </select>
    </div>
  )
}