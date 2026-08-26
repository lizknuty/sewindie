import { MapPin, LayoutGrid, FolderOpen, Star } from "lucide-react"

type DesignerStatsProps = {
  address: string | null
  patternCount: number
  collectionCount: number
  averageRating: number | null
  ratingCount: number
}

export default function DesignerStats({
  address,
  patternCount,
  collectionCount,
  averageRating,
  ratingCount,
}: DesignerStatsProps) {
  return (
    <section className="dstats" aria-label="Designer at a glance">
      <div className="dstat">
        <MapPin size={20} className="dstat-icon" aria-hidden="true" />
        <div className="dstat-body">
          {/* Falls back rather than hiding the cell, so the four-column rhythm
              holds for designers with no address on file. */}
          <p className="dstat-value dstat-value-text">{address?.trim() || "Location not listed"}</p>
        </div>
      </div>

      <div className="dstat">
        <LayoutGrid size={20} className="dstat-icon" aria-hidden="true" />
        <div className="dstat-body">
          <p className="dstat-value">{patternCount.toLocaleString()}</p>
          <p className="dstat-label">{patternCount === 1 ? "Pattern" : "Patterns"}</p>
        </div>
      </div>

      <div className="dstat">
        <FolderOpen size={20} className="dstat-icon" aria-hidden="true" />
        <div className="dstat-body">
          <p className="dstat-value">{collectionCount.toLocaleString()}</p>
          <p className="dstat-label">{collectionCount === 1 ? "Collection" : "Collections"}</p>
        </div>
      </div>

      <div className="dstat">
        <Star size={20} className="dstat-icon" aria-hidden="true" />
        <div className="dstat-body">
          {averageRating === null ? (
            <>
              <p className="dstat-value dstat-value-text">No ratings yet</p>
            </>
          ) : (
            <>
              <p className="dstat-value">{averageRating.toFixed(1)}</p>
              <p className="dstat-label">
                ({ratingCount.toLocaleString()} {ratingCount === 1 ? "rating" : "ratings"})
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
