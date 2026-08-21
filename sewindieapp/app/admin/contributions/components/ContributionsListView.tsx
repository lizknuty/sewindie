import type { ReactNode } from "react"
import type { PatternContribution } from "@/lib/google-sheets"
import ContributionStatusBadge from "./ContributionStatusBadge"

interface Props {
  contributions: PatternContribution[]
  renderActions: (contribution: PatternContribution) => ReactNode
}

export default function ContributionsListView({ contributions, renderActions }: Props) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Designer</th>
            <th>Categories</th>
            <th>Status</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((contribution) => (
            <tr key={contribution.rowIndex}>
              <td>
                <span className="pattern-name">{contribution.name || "Untitled"}</span>
              </td>
              <td className="text-muted-cell">{contribution.designer || "—"}</td>
              <td className="text-muted-cell">{contribution.categories || "—"}</td>
              <td>
                <ContributionStatusBadge status={contribution.status} />
              </td>
              <td>
                <div className="pattern-actions">{renderActions(contribution)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
