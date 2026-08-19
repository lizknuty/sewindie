import Link from "next/link"
import Image from "next/image"
import { Pencil, ExternalLink } from "lucide-react"
import DesignerStatusBadge from "./DesignerStatusBadge"
import type { AdminDesigner } from "@/admin/designers/types"

function formatWebsite(url: string | null): string {
  if (!url) return ""
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

export default function DesignersGrid({ designers }: { designers: AdminDesigner[] }) {
  return (
    <div className="patterns-grid">
      {designers.map((designer) => (
        <div key={designer.id} className="pattern-card designer-card">
          <div className="designer-card-media">
            {designer.logo_url ? (
              <Image
                src={designer.logo_url || "/placeholder.svg"}
                alt={designer.name ?? "Designer logo"}
                width={160}
                height={110}
              />
            ) : (
              <div className="pattern-card-media-empty" aria-hidden="true" />
            )}
            <div className="pattern-card-status">
              <DesignerStatusBadge status={designer.status} />
            </div>
          </div>
          <div className="pattern-card-body">
            <h3 className="pattern-card-title">{designer.name ?? "-"}</h3>
            {designer.url && (
              <a
                href={designer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="designer-website-link designer-card-link"
              >
                {formatWebsite(designer.url)}
                <ExternalLink size={12} />
              </a>
            )}
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{designer._count?.patterns ?? 0} patterns</span>
              <Link
                href={`/admin/designers/${designer.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${designer.name ?? "designer"}`}
                title="Edit designer"
              >
                <Pencil size={16} />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
