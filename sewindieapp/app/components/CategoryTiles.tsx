"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { LayoutGrid, X } from "lucide-react"

type CategoryOption = {
  id: number
  name: string
  count: number
}

type CategoryTilesProps = {
  /** The most-used categories, already ordered by pattern count on the server. */
  popular: CategoryOption[]
  /** Every category, revealed by "View all categories". */
  all: CategoryOption[]
}

export default function CategoryTiles({ popular, all }: CategoryTilesProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [showAll, setShowAll] = useState(false)

  const selected = searchParams.getAll("category")

  // Tiles are a shortcut into the same `category` param the sidebar writes, so
  // clicking one toggles it rather than replacing the whole filter set. That
  // keeps a tile and its sidebar checkbox in sync automatically.
  const toggleCategory = (id: number) => {
    const params = new URLSearchParams(searchParams.toString())
    const value = id.toString()
    if (params.getAll("category").includes(value)) {
      params.delete("category", value)
    } else {
      params.append("category", value)
    }
    params.delete("page")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <section className="pcats" aria-labelledby="pcats-heading">
      <div className="pcats-head">
        <h2 className="pcats-heading" id="pcats-heading">
          Popular categories
        </h2>

        {/* Sits with the heading rather than in the tile row: as an eighth
            tile it stretched into a full-width bar on its own line. */}
        <button
          type="button"
          className="pcats-all-toggle"
          onClick={() => setShowAll((prev) => !prev)}
          aria-expanded={showAll}
          aria-controls="pcats-all"
        >
          {showAll ? <X size={15} aria-hidden="true" /> : <LayoutGrid size={15} aria-hidden="true" />}
          {showAll ? "Hide all categories" : `View all ${all.length} categories`}
        </button>
      </div>

      <div className="pcats-row">
        {popular.map((cat) => {
          const isActive = selected.includes(cat.id.toString())
          return (
            <button
              key={cat.id}
              type="button"
              className={`pcats-tile ${isActive ? "pcats-tile-on" : ""}`}
              onClick={() => toggleCategory(cat.id)}
              aria-pressed={isActive}
            >
              <span className="pcats-tile-name">{cat.name}</span>
              <span className="pcats-tile-count">
                {cat.count.toLocaleString()} {cat.count === 1 ? "pattern" : "patterns"}
              </span>
            </button>
          )
        })}
      </div>

      {showAll && (
        <div className="pcats-all" id="pcats-all">
          {all.map((cat) => {
            const isActive = selected.includes(cat.id.toString())
            return (
              <button
                key={cat.id}
                type="button"
                className={`pcats-chip ${isActive ? "pcats-chip-on" : ""}`}
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={isActive}
              >
                {cat.name}
                <span className="pcats-chip-count">{cat.count.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
