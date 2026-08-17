"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"

type FilterOption = {
  id: number
  name: string
}

type AdminPatternFiltersProps = {
  categories: FilterOption[]
  attributes: FilterOption[]
  formats: FilterOption[]
  audiences: FilterOption[]
  fabricTypes: FilterOption[]
  designers: FilterOption[]
}

const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Published" },
  { value: "IN_TESTING", label: "In Testing" },
  { value: "DISCONTINUED", label: "Discontinued" },
]

const FILTER_KEYS = ["category", "attribute", "format", "audience", "fabricType", "designer", "status"]

export default function AdminPatternFilters({
  categories,
  attributes,
  formats,
  audiences,
  fabricTypes,
  designers,
}: AdminPatternFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const setSingleParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete(key)
      if (value) params.set(key, value)
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, searchParams, pathname],
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((k) => params.delete(k))
    router.push(`${pathname}?${params.toString()}`)
  }, [router, searchParams, pathname])

  const activeCount = FILTER_KEYS.filter((k) => searchParams.has(k)).length

  const renderSelect = (label: string, key: string, options: FilterOption[], allLabel: string) => (
    <div className="apf-field">
      <label className="apf-label" htmlFor={`apf-${key}`}>
        {label}
      </label>
      <select
        id={`apf-${key}`}
        className="apf-select"
        value={searchParams.get(key) ?? ""}
        onChange={(e) => setSingleParam(key, e.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id.toString()}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <aside className="apf-panel">
      <div className="apf-header">
        <h2 className="apf-title">Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="apf-clear" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {renderSelect("Category", "category", categories, "All categories")}
      {renderSelect("Attribute", "attribute", attributes, "All attributes")}
      {renderSelect("Format", "format", formats, "All formats")}
      {renderSelect("Audience", "audience", audiences, "All audiences")}
      {renderSelect("Fabric Type", "fabricType", fabricTypes, "All fabric types")}
      {renderSelect("Designer", "designer", designers, "All designers")}

      <div className="apf-field">
        <label className="apf-label" htmlFor="apf-status">
          Status
        </label>
        <select
          id="apf-status"
          className="apf-select"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setSingleParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  )
}
