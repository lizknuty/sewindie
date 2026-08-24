"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"

type ViewMode = "grid" | "list"

export default function PatternViewToggle({ view }: { view: ViewMode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const setView = (next: ViewMode) => {
    if (next === view) return
    const params = new URLSearchParams(searchParams.toString())
    // Grid is the default, so it stays out of the URL to keep shared links
    // clean; only the non-default needs to be recorded.
    if (next === "grid") {
      params.delete("view")
    } else {
      params.set("view", next)
    }
    // Changing layout keeps the same result set, so the page offset stays put.
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    // A radiogroup rather than two toggle buttons: exactly one layout is
    // always active, which is what aria-checked communicates.
    <div className="pview" role="radiogroup" aria-label="Result layout">
      <button
        type="button"
        role="radio"
        aria-checked={view === "grid"}
        className={`pview-btn ${view === "grid" ? "pview-btn-on" : ""}`}
        onClick={() => setView("grid")}
      >
        <LayoutGrid size={15} aria-hidden="true" />
        Grid
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={view === "list"}
        className={`pview-btn ${view === "list" ? "pview-btn-on" : ""}`}
        onClick={() => setView("list")}
      >
        <List size={15} aria-hidden="true" />
        List
      </button>
    </div>
  )
}
