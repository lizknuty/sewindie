"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { X } from "lucide-react"

type FilterOption = {
  id: number
  name: string
}

type ActiveFilterChipsProps = {
  /** id -> name lookups per filter type, used to label each chip. */
  options: Record<string, FilterOption[]>
}

// Order controls how chips read left to right; the labels are the display
// names for the same keys the sidebar and tiles write to the URL.
const FILTER_LABELS: { key: string; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "attribute", label: "Attribute" },
  { key: "format", label: "Format" },
  { key: "audience", label: "Audience" },
  { key: "fabricType", label: "Fabric Type" },
  { key: "designer", label: "Designer" },
]

export default function ActiveFilterChips({ options }: ActiveFilterChipsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const chips = FILTER_LABELS.flatMap(({ key, label }) =>
    searchParams.getAll(key).map((value) => {
      // An id in the URL that no longer exists (deleted record, hand-edited
      // link) would otherwise render "Category: undefined".
      const match = options[key]?.find((o) => o.id.toString() === value)
      return match ? { key, label, value, name: match.name } : null
    }),
  ).filter((chip): chip is { key: string; label: string; value: string; name: string } => chip !== null)

  const search = searchParams.get("search")

  // Nothing active means no bar at all, rather than an empty container.
  if (chips.length === 0 && !search) return null

  const removeChip = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key, value)
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const removeSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_LABELS.forEach(({ key }) => params.delete(key))
    params.delete("search")
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="pactive" role="region" aria-label="Active filters">
      <span className="pactive-label">Active filters:</span>

      <div className="pactive-chips">
        {search && (
          <button type="button" className="pactive-chip" onClick={removeSearch}>
            <span>Search: {search}</span>
            <X size={13} aria-hidden="true" />
            <span className="sr-only">Remove search filter</span>
          </button>
        )}

        {chips.map((chip) => (
          <button
            key={`${chip.key}-${chip.value}`}
            type="button"
            className="pactive-chip"
            onClick={() => removeChip(chip.key, chip.value)}
          >
            <span>
              {chip.label}: {chip.name}
            </span>
            <X size={13} aria-hidden="true" />
            <span className="sr-only">
              Remove {chip.label} {chip.name} filter
            </span>
          </button>
        ))}
      </div>

      <button type="button" className="pactive-clear" onClick={clearAll}>
        Clear all
      </button>
    </div>
  )
}
