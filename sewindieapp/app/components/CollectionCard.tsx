import Link from "next/link"
import { Lock, Globe } from "lucide-react"
import PatternThumbnail from "./PatternThumbnail"

export type CollectionCardProps = {
  id: number
  name: string
  description?: string | null
  visibility?: "PUBLIC" | "PRIVATE"
  patternCount: number
  /** Up to four thumbnails for the preview mosaic. */
  previews: { id: number; name: string; thumbnail_url: string | null }[]
  /** Owner display name — shown on designer pages, omitted in "my collections". */
  ownerName?: string | null
  /** Optional count of patterns by the designer whose page this appears on. */
  matchLabel?: string | null
  /** Renders the visibility pill. Only meaningful for the owner's own view. */
  showVisibility?: boolean
}

export default function CollectionCard({
  id,
  name,
  description,
  visibility,
  patternCount,
  previews,
  ownerName,
  matchLabel,
  showVisibility = false,
}: CollectionCardProps) {
  return (
    <article className="ccard">
      <Link href={`/collections/${id}`} className="ccard-mosaic" aria-label={name}>
        {previews.length === 0 ? (
          <span className="ccard-mosaic-empty">No patterns yet</span>
        ) : (
          // Always four cells: padding the tail with empty tiles keeps the 2x2
          // frame square, so a two-pattern collection doesn't leave a visible
          // half-height gap where the bottom row should be.
          <span className="ccard-mosaic-grid">
            {Array.from({ length: 4 }).map((_, i) => {
              const p = previews[i]
              return (
                <span key={p ? `p-${p.id}` : `empty-${i}`} className="ccard-mosaic-cell">
                  {p ? (
                    <PatternThumbnail
                      src={p.thumbnail_url}
                      alt={`${p.name} thumbnail`}
                      fill
                      sizes="160px"
                      className="ccard-mosaic-img"
                    />
                  ) : null}
                </span>
              )
            })}
          </span>
        )}
      </Link>

      <div className="ccard-body">
        <h3 className="ccard-name">
          <Link href={`/collections/${id}`}>{name}</Link>
        </h3>

        {ownerName && <p className="ccard-owner">by {ownerName}</p>}

        {description && <p className="ccard-desc">{description}</p>}

        <div className="ccard-foot">
          <span className="ccard-count">
            {patternCount.toLocaleString()} {patternCount === 1 ? "pattern" : "patterns"}
          </span>

          {matchLabel && <span className="ccard-match">{matchLabel}</span>}

          {showVisibility && visibility && (
            <span className="ccard-vis">
              {visibility === "PUBLIC" ? (
                <>
                  <Globe size={13} aria-hidden="true" />
                  Public
                </>
              ) : (
                <>
                  <Lock size={13} aria-hidden="true" />
                  Private
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
