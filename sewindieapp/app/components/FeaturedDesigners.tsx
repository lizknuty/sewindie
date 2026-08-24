"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DesignerAvatar from "./DesignerAvatar"

export type FeaturedDesigner = {
  id: number
  name: string
  logoUrl: string | null
}

/**
 * Horizontal designer rail.
 *
 * Uses a native overflow scroller with scroll-snap rather than a carousel
 * library: the row is a list of links, so native scrolling gives keyboard,
 * trackpad, and touch behaviour for free, and the arrows are a thin wrapper
 * over scrollBy.
 */
export default function FeaturedDesigners({ designers }: { designers: FeaturedDesigner[] }) {
  const railRef = useRef<HTMLUListElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const syncArrows = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    // 1px of slack absorbs sub-pixel rounding at fractional zoom levels, which
    // would otherwise leave the end arrow permanently enabled.
    const maxScroll = rail.scrollWidth - rail.clientWidth
    setAtStart(rail.scrollLeft <= 1)
    setAtEnd(rail.scrollLeft >= maxScroll - 1)
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    syncArrows()
    // The rail's overflow depends on its own width, so a viewport resize can
    // flip whether the arrows are needed at all.
    const observer = new ResizeObserver(syncArrows)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [syncArrows])

  function scrollByCards(direction: 1 | -1) {
    const rail = railRef.current
    if (!rail) return
    // A full rail width is exactly one set of 6 on desktop, so each press pages
    // to the next six. scroll-snap keeps the landing position on a card edge.
    rail.scrollBy({ left: direction * rail.clientWidth, behavior: "smooth" })
  }

  if (designers.length === 0) return null

  return (
    <section className="home-section" aria-labelledby="featured-designers-title">
      <div className="home-section-head">
        <h2 id="featured-designers-title" className="home-section-title">
          Featured Designers
        </h2>
        <div className="home-section-tools">
          <Link href="/designers" className="home-view-all">
            View all
          </Link>
          <div className="home-rail-nav">
            <button
              type="button"
              className="home-rail-btn"
              onClick={() => scrollByCards(-1)}
              disabled={atStart}
              aria-label="Scroll designers left"
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="home-rail-btn"
              onClick={() => scrollByCards(1)}
              disabled={atEnd}
              aria-label="Scroll designers right"
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <ul className="home-designer-rail" ref={railRef} onScroll={syncArrows}>
        {designers.map((designer) => (
          <li key={designer.id} className="home-designer-item">
            <Link href={`/designers/${designer.id}`} className="home-designer-link">
              <DesignerAvatar name={designer.name} logoUrl={designer.logoUrl} />
              <span className="home-designer-name">{designer.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
