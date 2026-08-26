import React from "react"
import Image from "next/image"
import PatternSearch from "./PatternSearch"

type BrowseHeroProps = {
  title: string
  lede: string
  initialSearch: string
  /** Placeholder + accessible label for the search field. */
  searchPlaceholder: string
  searchLabel: string
  /** Ids must be unique per document; each page passes its own. */
  searchInputId: string
  imageSrc: string
}

/**
 * Shared hero band for the browse pages (/patterns, /designers).
 *
 * Was PatternsHero, hardcoded to the patterns copy. The designers page needs
 * the identical band with different words, so the copy is props rather than a
 * second component with a duplicated `.phero` tree that could drift.
 */
export default function BrowseHero({
  title,
  lede,
  initialSearch,
  searchPlaceholder,
  searchLabel,
  searchInputId,
  imageSrc,
}: BrowseHeroProps) {
  return (
    <section className="phero">
      <div className="phero-inner">
        <div className="phero-copy">
          <h1 className="phero-title text-balance">{title}</h1>
          <p className="phero-lede text-pretty">{lede}</p>
          <PatternSearch
            initialSearch={initialSearch}
            placeholder={searchPlaceholder}
            label={searchLabel}
            inputId={searchInputId}
          />
        </div>

        {/* Decorative: the headline already conveys the message, so an alt
            description here would just repeat it for screen readers. */}
        <div className="phero-media">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="phero-image"
            sizes="(min-width: 992px) 45vw, 100vw"
            priority
          />
        </div>
      </div>
    </section>
  )
}
