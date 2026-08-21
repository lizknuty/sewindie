import Link from "next/link"
import { Pencil } from "lucide-react"
import type { MetadataItem } from "../types"

type Props = {
  items: MetadataItem[]
  columnLabel: string
  singular: string
  basePath: string
}

export default function MetadataTable({ items, columnLabel, singular, basePath }: Props) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>{columnLabel}</th>
            <th className="text-end">Patterns</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="pattern-name">{item.name}</span>
              </td>
              <td className="text-end text-muted-cell">{item.patternCount.toLocaleString()}</td>
              <td>
                <div className="pattern-actions">
                  <Link
                    href={`${basePath}/${item.id}/edit`}
                    className="action-icon-btn"
                    aria-label={`Edit ${item.name}`}
                    title={`Edit ${singular.toLowerCase()}`}
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
