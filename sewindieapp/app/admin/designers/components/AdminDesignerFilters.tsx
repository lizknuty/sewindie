"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"

const STATUS_OPTIONS = [
  { value: "PUBLISHED", label: "Published" },
  { value: "INACTIVE", label: "Inactive" },
]

const FILTER_KEYS = ["status"]

export default function AdminDesignerFilters() {
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
