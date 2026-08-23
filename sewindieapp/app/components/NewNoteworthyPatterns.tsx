import Link from "next/link"
import { Heart } from "lucide-react"
import PatternThumbnail from "./PatternThumbnail"

export type NoteworthyPattern = {
  id: number
  name: string
  designerName: string
  thumbnailUrl: string | null
  favoriteCount: number
}

export default function NewNoteworthyPatterns({ patterns }: { patterns: NoteworthyPattern[] }) {
  if (patterns.length === 0) return null

  return (
    <section className="home-section" aria-labelledby="noteworthy-title">
      <div className="home-section-head">
        <h2 id="noteworthy-title" className="home-section-title">
          New &amp; Noteworthy Patterns
        </h2>
        <Link href="/patterns" className="home-view-all">
          {/* "patterns" is hidden on narrow screens so this link can't push the
              (nowrap) heading off-screen. It stays in the DOM, so the accessible
              name remains "View all patterns" at every width. */}
          View all<span className="home-view-all-suffix"> patterns</span>
        </Link>
      </div>

      <ul className="home-pattern-grid">
        {patterns.map((pattern) => (
          <li key={pattern.id} className="home-pattern-item">
            <Link href={`/patterns/${pattern.id}`} className="home-pattern-link">
              <span className="home-pattern-media">
                <PatternThumbnail
                  src={pattern.thumbnailUrl}
                  alt={pattern.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                  style={{ objectFit: "cover" }}
                />
              </span>
              <span className="home-pattern-name">{pattern.name}</span>
            </Link>

            <div className="home-pattern-meta">
              <span className="home-pattern-designer">{pattern.designerName}</span>
              {/* aria-label carries the whole phrase because the bare number
                  and a decorative icon say nothing on their own. */}
              <span
                className="home-pattern-faves"
                aria-label={`${pattern.favoriteCount} ${
                  pattern.favoriteCount === 1 ? "favorite" : "favorites"
                }`}
              >
                <Heart size={14} strokeWidth={2} aria-hidden="true" />
                <span aria-hidden="true">{pattern.favoriteCount}</span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
