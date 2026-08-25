"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { LayoutGrid, Shirt, X } from "lucide-react"
import {
  CoatIcon,
  DressIcon,
  type GarmentIconProps,
  JumpsuitIcon,
  PantsIcon,
  ShortsIcon,
  SkirtIcon,
  SweaterIcon,
  TopIcon,
} from "./GarmentIcons"

type CategoryOption = {
  id: number
  name: string
  count: number
}

/**
 * Category names come from the database, so the tiles match on keywords rather
 * than exact strings or ids -- renaming "Pants / Jeans" or promoting a new
 * category into the top seven shouldn't silently drop its icon.
 *
 * Order is significant: "Sweater / Sweatshirt" contains "shirt", so the knit
 * test has to run before the tops test, and "shorts" before "short sleeve".
 */
const ICON_RULES: Array<[RegExp, (props: GarmentIconProps) => React.JSX.Element]> = [
  [/dress|gown/, DressIcon],
  [/skirt/, SkirtIcon],
  [/sweat|hoodie|jumper|knit|cardigan/, SweaterIcon],
  [/coat|jacket|blazer|outerwear|vest/, CoatIcon],
  [/short/, ShortsIcon],
  [/jumpsuit|romper|overall|dungaree/, JumpsuitIcon],
  [/pant|jean|trouser|legging|bottom/, PantsIcon],
  [/top|shirt|tee|blouse|tank|bodice/, TopIcon],
]

function categoryIcon(name: string) {
  const key = name.toLowerCase()
  const match = ICON_RULES.find(([pattern]) => pattern.test(key))
  // Falls back to lucide's shirt so an unmapped category still gets a glyph
  // and the tiles keep a uniform height.
  return match ? match[1] : Shirt
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
      <h2 className="pcats-heading" id="pcats-heading">
        Popular categories
      </h2>

      <div className="pcats-row">
        {popular.map((cat) => {
          const isActive = selected.includes(cat.id.toString())
          const Icon = categoryIcon(cat.name)
          return (
            <button
              key={cat.id}
              type="button"
              className={`pcats-tile ${isActive ? "pcats-tile-on" : ""}`}
              onClick={() => toggleCategory(cat.id)}
              aria-pressed={isActive}
            >
              <Icon size={30} className="pcats-tile-icon" />
              <span className="pcats-tile-name">{cat.name}</span>
              <span className="pcats-tile-count">{cat.count.toLocaleString()}</span>
            </button>
          )
        })}

        {/* The eighth tile, matching the mockup. It's a disclosure rather than a
            filter, so it carries aria-expanded instead of aria-pressed. */}
        <button
          type="button"
          className={`pcats-tile pcats-tile-all ${showAll ? "pcats-tile-on" : ""}`}
          onClick={() => setShowAll((prev) => !prev)}
          aria-expanded={showAll}
          aria-controls="pcats-all"
        >
          {showAll ? (
            <X size={30} className="pcats-tile-icon" aria-hidden="true" />
          ) : (
            <LayoutGrid size={30} className="pcats-tile-icon" aria-hidden="true" />
          )}
          <span className="pcats-tile-name">{showAll ? "Hide categories" : "View all categories"}</span>
        </button>
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
