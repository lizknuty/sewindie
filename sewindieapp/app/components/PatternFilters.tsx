'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp } from 'lucide-react'

type FilterOption = {
  id: number;
  name: string;
}

type FilterProps = {
  categories: FilterOption[];
  attributes: FilterOption[];
  formats: FilterOption[];
  audiences: string[];
  fabricTypes: string[];
}

type FilterTypes = 'category' | 'attribute' | 'format' | 'audience' | 'fabricType'

type SelectedFilters = {
  [K in FilterTypes]: string[];
}

type ExpandedSections = {
  [K in FilterTypes]: boolean;
}

export default function PatternFilters({ categories, attributes, formats, audiences, fabricTypes }: FilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    category: searchParams.getAll('category'),
    attribute: searchParams.getAll('attribute'),
    format: searchParams.getAll('format'),
    audience: searchParams.getAll('audience'),
    fabricType: searchParams.getAll('fabricType'),
  })

  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    category: false,
    attribute: false,
    format: false,
    audience: false,
    fabricType: false,
  })

  const handleFilterChange = (filterType: FilterTypes, value: string) => {
    setSelectedFilters(prev => {
      const updatedFilters = { ...prev }
      if (updatedFilters[filterType].includes(value)) {
        updatedFilters[filterType] = updatedFilters[filterType].filter(item => item !== value)
      } else {
        updatedFilters[filterType] = [...updatedFilters[filterType], value]
      }
      return updatedFilters
    })
  }

  const toggleSection = (section: FilterTypes) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    Object.entries(selectedFilters).forEach(([key, values]) => {
      params.delete(key)
      values.forEach(value => params.append(key, value))
    })
    router.push(`/patterns?${params.toString()}`)
  }, [selectedFilters, router, searchParams])

  const renderFilterSection = (title: string, options: FilterOption[] | string[], filterType: FilterTypes) => (
    <div className="mb-4">
      <button
        className="w-full flex justify-between items-center text-lg font-semibold mb-2 bg-gray-100 p-2 rounded"
        onClick={() => toggleSection(filterType)}
      >
        {title}
        {expandedSections[filterType] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      {expandedSections[filterType] && (
        <div className="pl-2">
          {options.map((option, index) => {
            const value = typeof option === 'string' ? option : option.id.toString()
            const label = typeof option === 'string' ? option : option.name
            return (
              <div key={index} className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`${filterType}-${value}`}
                  value={value}
                  checked={selectedFilters[filterType].includes(value)}
                  onChange={() => handleFilterChange(filterType, value)}
                />
                <label className="form-check-label" htmlFor={`${filterType}-${value}`}>
                  {label}
                </label>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Filters</h2>
      {renderFilterSection('Category', categories, 'category')}
      {renderFilterSection('Attribute', attributes, 'attribute')}
      {renderFilterSection('Format', formats, 'format')}
      {renderFilterSection('Audience', audiences, 'audience')}
      {renderFilterSection('Fabric Type', fabricTypes, 'fabricType')}
    </div>
  )
}