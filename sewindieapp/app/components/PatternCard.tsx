import React from "react"
import Link from "next/link"
import PatternThumbnail from "./PatternThumbnail"

type PatternCardProps = {
  id: number
  name: string
  thumbnail_url: string | null
  designer: {
    id: number
    name: string
  }
  patternCategories: {
    category: {
      id: number
      name: string
    }
  }[]
}

export default function PatternCard({ id, name, thumbnail_url, designer, patternCategories }: PatternCardProps) {
  if (!id || !name || !designer) {
    console.error("Invalid pattern data:", { id, name, designer })
    return null
  }

  return (
    // Not a single wrapping link: the card holds two separate destinations
    // (pattern and designer), so nesting them would be invalid markup.
    <article className="pcard">
      <Link href={`/patterns/${id}`} className="pcard-media" aria-label={name}>
        {thumbnail_url ? (
          <PatternThumbnail
            src={thumbnail_url}
            alt={`${name} thumbnail`}
            fill
            sizes="(min-width: 1200px) 20vw, (min-width: 992px) 25vw, (min-width: 576px) 50vw, 100vw"
          />
        ) : (
          <span className="pcard-media-empty">No image</span>
        )}
      </Link>
      <div className="pcard-body">
        <h3 className="pcard-name">
          <Link href={`/patterns/${id}`}>{name}</Link>
        </h3>
        <p className="pcard-designer">
          <Link href={`/designers/${designer.id}`}>{designer.name}</Link>
        </p>
        {patternCategories && patternCategories.length > 0 && (
          <div className="pcard-tags">
            {patternCategories.map((pc) => (
              <span key={pc.category.id} className="pcard-tag">
                {pc.category.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
