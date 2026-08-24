"use client"

import { useState } from "react"
import Image from "next/image"

/** "Fibre Mood" -> "FM"; falls back to the first character for one-word names. */
function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

/**
 * Designer logo with an initials fallback.
 *
 * Logos are hotlinked from each designer's own CDN, so some fail to load
 * (dead URL, hotlink protection). next/image cannot recover from that, and a
 * broken-image glyph is worse than no image, so swap in the initials instead.
 */
export default function DesignerAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(logoUrl) && !failed

  return (
    <span className="home-designer-avatar">
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt=""
          fill
          sizes="112px"
          className="home-designer-logo"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="home-designer-initials" aria-hidden="true">
          {initialsFor(name)}
        </span>
      )}
    </span>
  )
}
