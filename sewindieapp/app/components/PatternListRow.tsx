import React from "react"
import Link from "next/link"
import PatternThumbnail from "./PatternThumbnail"

type Named = { id: number; name: string }

type PatternListRowProps = {
  id: number
  name: string
  thumbnail_url: string | null
  designer: { id: number; name: string }
  categories: Named[]
  fabricTypes: Named[]
  audiences: Named[]
}

export default function PatternListRow({
  id,
  name,
  thumbnail_url,
  designer,
  categories,
  fabricTypes,
  audiences,
}: PatternListRowProps) {
  // The row carries two destinations (pattern and designer), so it can't be a
  // single wrapping link — same reasoning as PatternCard.
  return (
    <article className="prow">
      <Link href={`/patterns/${id}`} className="prow-media" aria-label={name}>
        {thumbnail_url ? (
          <PatternThumbnail src={thumbnail_url} alt={`${name} thumbnail`} fill sizes="120px" />
        ) : (
          <span className="prow-media-empty">No image</span>
        )}
      </Link>

      <div className="prow-main">
        <h3 className="prow-name">
          <Link href={`/patterns/${id}`}>{name}</Link>
        </h3>
        <p className="prow-designer">
          <Link href={`/designers/${designer.id}`}>{designer.name}</Link>
        </p>
        {categories.length > 0 && (
          <div className="prow-tags">
            {categories.map((c) => (
              <span key={c.id} className="prow-tag">
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Only rendered when the pattern actually has this metadata, so rows
          never show an empty labelled column. */}
      <dl className="prow-meta">
        {fabricTypes.length > 0 && (
          <div className="prow-meta-item">
            <dt className="prow-meta-label">Fabric</dt>
            <dd className="prow-meta-value">{fabricTypes.map((f) => f.name).join(", ")}</dd>
          </div>
        )}
        {audiences.length > 0 && (
          <div className="prow-meta-item">
            <dt className="prow-meta-label">Audience</dt>
            <dd className="prow-meta-value">{audiences.map((a) => a.name).join(", ")}</dd>
          </div>
        )}
      </dl>
    </article>
  )
}
