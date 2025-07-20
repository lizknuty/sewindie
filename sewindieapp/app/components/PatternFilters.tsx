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

  useEffect(() => {
    const style = document.createElement("style")
    style.textContent = `
      .scrollable-filter {
        max-height: 200px;
        overflow-y: auto;
        padding-right: 10px;
        background-color: var(--color-light); /* Changed to var(--color-light) */
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

      /* Override Bootstrap's form-check behavior for custom-checkbox */
      .form-check {
        padding-left: 0 !important; /* Remove Bootstrap's default padding */
        margin-left: 1.5rem; /* Add desired indentation for the whole form-check element */
      }

      .custom-checkbox .form-check-input {
        border-color: #adb5bd;
        width: 1.25rem;
        height: 1.25rem;
        /* Override Bootstrap's negative margin to keep it aligned with the new padding */
        margin-left: 0 !important;
      }

      .custom-checkbox .form-check-input:checked {
        background-color: var(--color-primary) !important; /* Align with user's styles.css */
        border-color: var(--color-primary) !important; /* Align with user's styles.css */
      }

      .custom-checkbox .form-check-input:checked::after {
        content: '';
        display: block;
        width: 6px;
        height: 12px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        position: absolute;
        top: 2px;
        left: 6px;
      }

      .custom-checkbox .form-check-label {
        padding-left: 0.5rem;
        color: var(--color-dark); /* Ensure label color is consistent */
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

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
