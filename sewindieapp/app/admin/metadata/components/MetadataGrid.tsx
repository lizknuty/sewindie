import Link from "next/link"
import { Pencil, type LucideIcon } from "lucide-react"
import type { MetadataItem } from "../types"

type Props = {
  items: MetadataItem[]
  icon: LucideIcon
  singular: string
  basePath: string
}

export default function MetadataGrid({ items, icon: Icon, singular, basePath }: Props) {
  return (
    <div className="patterns-grid">
      {items.map((item) => (
        <div key={item.id} className="pattern-card category-card">
          <div className="category-card-body">
            <div className="category-card-icon" aria-hidden="true">
              <Icon size={18} />
            </div>
            <h3 className="pattern-card-title">{item.name}</h3>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{item.patternCount.toLocaleString()} patterns</span>
              <Link
                href={`${basePath}/${item.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${item.name}`}
                title={`Edit ${singular.toLowerCase()}`}
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
