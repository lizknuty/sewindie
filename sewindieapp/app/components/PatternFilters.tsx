"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState, useEffect, useMemo, useCallback } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

type FilterOption = {
  id: number
  name: string
}

type PatternFiltersProps = {
  categories: FilterOption[]
  attributes: FilterOption[]
  formats: FilterOption[]
  audiences: FilterOption[]
  fabricTypes: FilterOption[]
  designers: FilterOption[]
}

// Section titles are display-only; the URL key is what identifies a section, so
// expanded state is tracked by filterType rather than by lowercased label.
const FILTER_TYPES = ["category", "attribute", "format", "audience", "fabricType", "designer"] as const

export default function PatternFilters({
  categories,
  attributes,
  formats,
  audiences,
  fabricTypes,
  designers,
}: PatternFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  // Open whichever sections already have a filter applied, so arriving on a
  // filtered URL shows what's active instead of hiding it behind a collapsed row.
  useEffect(() => {
    setExpandedSections(FILTER_TYPES.filter((type) => searchParams.has(type)))
  }, [searchParams])

  const handleFilterChange = useCallback(
    (filterType: string, value: string) => {
      const currentParams = new URLSearchParams(searchParams.toString())
      const currentValues = currentParams.getAll(filterType)
      if (currentValues.includes(value)) {
        currentParams.delete(filterType, value)
      } else {
        currentParams.append(filterType, value)
      }
      // Narrowing or widening the results invalidates the current page offset.
      currentParams.delete("page")
      router.push(`${pathname}?${currentParams.toString()}`)
    },
    [router, searchParams, pathname],
  )

  const handleClearAll = useCallback(() => {
    const currentParams = new URLSearchParams(searchParams.toString())
    FILTER_TYPES.forEach((type) => currentParams.delete(type))
    currentParams.delete("page")
    const qs = currentParams.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams, pathname])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }, [])

  const renderFilterSection = useCallback(
    (title: string, options: FilterOption[], filterType: string) => {
      const isExpanded = expandedSections.includes(filterType)
      const selected = searchParams.getAll(filterType)
      const panelId = `pfilter-panel-${filterType}`

      return (
        <div className="pfilters-section" key={filterType}>
          <button
            type="button"
            className="pfilters-toggle"
            onClick={() => toggleSection(filterType)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
          >
            <span>{title}</span>
            {selected.length > 0 && <span className="pfilters-badge">{selected.length}</span>}
            {isExpanded ? (
              <ChevronDown size={16} className="pfilters-toggle-icon" aria-hidden="true" />
            ) : (
              <ChevronRight size={16} className="pfilters-toggle-icon" aria-hidden="true" />
            )}
          </button>

          {isExpanded && (
            <div className="pfilters-options" id={panelId}>
              {options.map((option) => {
                const isChecked = selected.includes(option.id.toString())
                return (
                  <label className="pfilters-option" key={option.id} htmlFor={`${filterType}-${option.id}`}>
                    <input
                      className="pfilters-native"
                      type="checkbox"
                      id={`${filterType}-${option.id}`}
                      checked={isChecked}
                      onChange={() => handleFilterChange(filterType, option.id.toString())}
                    />
                    <span className="pfilters-box" aria-hidden="true">
                      {isChecked && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6.5L4.5 9L10 3.5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="pfilters-option-label">{option.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )
    },
    [expandedSections, handleFilterChange, searchParams, toggleSection],
  )

  const activeCount = useMemo(
    () => FILTER_TYPES.reduce((sum, type) => sum + searchParams.getAll(type).length, 0),
    [searchParams],
  )

  return (
    <aside className="pfilters" aria-label="Pattern filters">
      <div className="pfilters-head">
        <h2 className="pfilters-title">Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="pfilters-clear" onClick={handleClearAll}>
            Clear all ({activeCount})
          </button>
        )}
      </div>
      {renderFilterSection("Category", categories, "category")}
      {renderFilterSection("Attribute", attributes, "attribute")}
      {renderFilterSection("Format", formats, "format")}
      {renderFilterSection("Audience", audiences, "audience")}
      {renderFilterSection("Fabric Type", fabricTypes, "fabricType")}
      {renderFilterSection("Designer", designers, "designer")}
    </aside>
  )
}
