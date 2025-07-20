"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  // Initialize expanded sections based on current search params
  useEffect(() => {
    const initialExpanded: string[] = []
    const filterTypes = ["category", "attribute", "format", "audience", "fabricType", "designer"]
    filterTypes.forEach((type) => {
      if (searchParams.has(type)) {
        initialExpanded.push(type)
      }
    })
    setExpandedSections(initialExpanded)
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
      router.push(`/admin/patterns?${currentParams.toString()}`)
    },
    [router, searchParams],
  )

  const handleClearAll = useCallback(() => {
    const currentParams = new URLSearchParams(searchParams.toString())
    const filterTypes = ["category", "attribute", "format", "audience", "fabricType", "designer"]
    filterTypes.forEach((type) => {
      currentParams.delete(type)
    })
    router.push(`/admin/patterns?${currentParams.toString()}`)
  }, [router, searchParams])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }, [])

  const MemoizedChevronDown = useMemo(() => <ChevronDown className="h-5 w-5" />, [])
  const MemoizedChevronRight = useMemo(() => <ChevronRight className="h-5 w-5" />, [])

  const renderFilterSection = useCallback(
    (title: string, options: FilterOption[], filterType: string) => (
      <div className="card mb-3 border-0">
        <div className="card-header bg-white border-0 p-0">
          <button
            className="btn btn-link w-100 text-left d-flex justify-content-between align-items-center text-muted"
            onClick={() => toggleSection(title.toLowerCase())}
          >
            <span>{title}</span>
            {expandedSections.includes(title.toLowerCase()) ? MemoizedChevronDown : MemoizedChevronRight}
          </button>
        </div>
        {expandedSections.includes(title.toLowerCase()) && (
          <div className="card-body p-0">
            <div className="space-y-2 scrollable-filter">
              {options.map((option) => {
                const isChecked = searchParams.getAll(filterType).includes(option.id.toString())
                return (
                  <div key={option.id} className="form-check custom-checkbox">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`${filterType}-${option.id}`}
                      checked={isChecked}
                      onChange={() => handleFilterChange(filterType, option.id.toString())}
                    />
                    <label
                      className="form-check-label"
                      htmlFor={`${filterType}-${option.id}`}
                      style={{ color: "var(--color-dark)" }}
                    >
                      {option.name}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    ),
    [expandedSections, handleFilterChange, searchParams, MemoizedChevronDown, MemoizedChevronRight, toggleSection],
  )

  const isAnyFilterApplied = useMemo(() => {
    const filterTypes = ["category", "attribute", "format", "audience", "fabricType", "designer"]
    return filterTypes.some((type) => searchParams.has(type))
  }, [searchParams])

  return (
    <div className="p-4 rounded border border-gray-200" style={{ backgroundColor: "#8f7a7c" }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="h4 mb-0" style={{ color: "var(--color-light)" }}>
          Filters
        </h2>
        {isAnyFilterApplied && (
          <button className="btn btn-sm btn-outline-light" onClick={handleClearAll}>
            Clear All
          </button>
        )}
      </div>
      {renderFilterSection("Category", categories, "category")}
      {renderFilterSection("Attribute", attributes, "attribute")}
      {renderFilterSection("Format", formats, "format")}
      {renderFilterSection("Audience", audiences, "audience")}
      {renderFilterSection("Fabric Type", fabricTypes, "fabricType")}
      {renderFilterSection("Designer", designers, "designer")}
    </div>
  )
}
