'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
)

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
)

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

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .scrollable-filter {
        max-height: 200px;
        overflow-y: auto;
        padding-right: 10px;
        background-color: white;
      }
      .scrollable-filter::-webkit-scrollbar {
        width: 6px;
      }
      .scrollable-filter::-webkit-scrollbar-track {
        background: #f1f1f1;
      }
      .scrollable-filter::-webkit-scrollbar-thumb {
        background: var(--color-muted);
        border-radius: 3px;
      }
      .scrollable-filter::-webkit-scrollbar-thumb:hover {
        background: var(--color-primary);
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const handleFilterChange = useCallback((filterType: string, value: string) => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const currentValues = currentParams.getAll(filterType)

    if (currentValues.includes(value)) {
      currentParams.delete(filterType, value)
    } else {
      currentParams.append(filterType, value)
    }

    router.push(`/patterns?${currentParams.toString()}`)
  }, [router, searchParams])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const isExpanded = prev.includes(section)
      return isExpanded ? prev.filter(s => s !== section) : [...prev, section]
    })
  }, [])

  const MemoizedChevronDown = useMemo(() => <ChevronDown />, [])
  const MemoizedChevronRight = useMemo(() => <ChevronRight />, [])

  const renderFilterSection = useCallback((title: string, options: FilterOption[] | string[], filterType: string) => {
    const isExpanded = expandedSections.includes(title.toLowerCase())
    return (
      <div className="card mb-3 border-0">
        <div className="card-header bg-white border-0 p-0">
          <button
            className="btn btn-link w-100 text-left d-flex justify-content-between align-items-center text-muted"
            onClick={() => toggleSection(title.toLowerCase())}
          >
            <span>{title}</span>
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </button>
        </div>
        {isExpanded && (
          <div className="card-body p-0">
            <div className={`pl-4 space-y-2 ${(filterType === 'category' || filterType === 'designer') ? 'scrollable-filter' : ''}`}>
              {options.map((option) => {
                const optionId = typeof option === 'string' ? option : option.id.toString()
                const optionName = typeof option === 'string' ? option : option.name
                return (
                  <div key={optionId} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`${filterType}-${optionId}`}
                      checked={searchParams.getAll(filterType).includes(optionId)}
                      onChange={() => handleFilterChange(filterType, optionId)}
                      style={{ borderColor: '#d1d5db', backgroundColor: '#fff' }}
                    />
                    <label
                      className="form-check-label"
                      htmlFor={`${filterType}-${optionId}`}
                      style={{ color: 'var(--color-dark)' }}
                    >
                      {optionName}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }, [expandedSections, handleFilterChange, searchParams, toggleSection])

  return (
    <div className="p-4 rounded border border-gray-200" style={{ backgroundColor: '#8f7a7c' }}>
      <h2 className="h4 mb-4" style={{ color: 'var(--color-light)' }}>Filters</h2>
      {renderFilterSection('Category', categories, 'category')}
      {renderFilterSection('Attribute', attributes, 'attribute')}
      {renderFilterSection('Format', formats, 'format')}
      {renderFilterSection('Audience', audiences, 'audience')}
      {renderFilterSection('Fabric Type', fabricTypes, 'fabricType')}
      {renderFilterSection('Designer', designers, 'designer')}
    </div>
  )
}