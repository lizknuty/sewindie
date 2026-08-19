import Link from "next/link"
import Image from "next/image"
import { Pencil, ExternalLink } from "lucide-react"
import DesignerStatusBadge from "./DesignerStatusBadge"
import type { AdminDesigner } from "@/admin/designers/types"

function formatWebsite(url: string | null): string {
  if (!url) return "-"
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

export default function DesignersTable({ designers }: { designers: AdminDesigner[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Logo</th>
            <th>Designer</th>
            <th>Website</th>
            <th className="text-end">Patterns</th>
            <th>Status</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {designers.map((designer) => (
            <tr key={designer.id}>
              <td>
                <div className="designer-logo">
                  {designer.logo_url ? (
                    <Image
                      src={designer.logo_url || "/placeholder.svg"}
                      alt={designer.name ?? "Designer logo"}
                      width={56}
                      height={40}
                    />
                  ) : (
                    <div className="designer-logo-empty" aria-hidden="true" />
                  )}
                </div>
              </td>
              <td>
                <span className="pattern-name">{designer.name ?? "-"}</span>
              </td>
              <td>
                {designer.url ? (
                  <a href={designer.url} target="_blank" rel="noopener noreferrer" className="designer-website-link">
                    {formatWebsite(designer.url)}
                    <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="text-muted-cell">-</span>
                )}
              </td>
              <td className="text-end text-muted-cell">{designer._count?.patterns ?? 0}</td>
              <td>
                <DesignerStatusBadge status={designer.status} />
              </td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`/admin/designers/${designer.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${designer.name ?? "designer"}`}
                    title="Edit designer"
                  >
                    <Pencil size={16} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
