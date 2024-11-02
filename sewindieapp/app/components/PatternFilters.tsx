'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

type FilterOption = {
  id: number;
  name: string;
}

type PatternFiltersProps = {
  categories: FilterOption[];
  attributes: FilterOption[];
  formats: FilterOption[];
  audiences: string[];
  fabricTypes: string[];
  designers: FilterOption[];
}

export default function PatternFilters({ categories, attributes, formats, audiences, fabricTypes, designers }: PatternFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  const handleFilterChange = (filterType: string, value: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const currentValues = currentParams.getAll(filterType)

    if (currentValues.includes(value)) {
      currentParams.delete(filterType, value)
    } else {
      currentParams.append(filterType, value)
    }

    router.push(`/patterns?${currentParams.toString()}`)
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const renderFilterSection = (title: string, options: FilterOption[] | string[], filterType: string) => (
    <div className="mb-4">
      <button
        className="flex items-center justify-between w-full text-left font-semibold mb-2"
        onClick={() => toggleSection(title.toLowerCase())}
      >
        <span>{title}</span>
        {expandedSections.includes(title.toLowerCase()) ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {expandedSections.includes(title.toLowerCase()) && (
        <div className="pl-4">
          {options.map((option) => (
            <div key={typeof option === 'string' ? option : option.id} className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                id={`${filterType}-${typeof option === 'string' ? option : option.id}`}
                checked={searchParams.getAll(filterType).includes(typeof option === 'string' ? option : option.id.toString())}
                onChange={() => handleFilterChange(filterType, typeof option === 'string' ? option : option.id.toString())}
              />
              <label
                htmlFor={`${filterType}-${typeof option === 'string' ? option : option.id}`}
                className="text-sm"
              >
                {typeof option === 'string' ? option : option.name}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Filters</h2>
      {renderFilterSection('Category', categories, 'category')}
      {renderFilterSection('Attribute', attributes, 'attribute')}
      {renderFilterSection('Format', formats, 'format')}
      {renderFilterSection('Audience', audiences, 'audience')}
      {renderFilterSection('Fabric Type', fabricTypes, 'fabricType')}
      {renderFilterSection('Designer', designers, 'designer')}
    </div>
  )
}