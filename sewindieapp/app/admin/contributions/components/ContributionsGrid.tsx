import type { ReactNode } from "react"
import type { PatternContribution } from "@/lib/google-sheets"
import ContributionStatusBadge from "./ContributionStatusBadge"

interface Props {
  contributions: PatternContribution[]
  renderActions: (contribution: PatternContribution) => ReactNode
}

export default function ContributionsGrid({ contributions, renderActions }: Props) {
  return (
    <div className="patterns-grid">
      {contributions.map((contribution) => (
        <article className="pattern-card" key={contribution.rowIndex}>
          <div className="user-card-body">
            <div className="user-card-head">
              <ContributionStatusBadge status={contribution.status} />
            </div>
            <h3 className="pattern-card-title">{contribution.name || "Untitled"}</h3>
            <p className="pattern-card-designer">{contribution.designer || "Unknown designer"}</p>
            {contribution.categories?.trim() && <p className="user-card-email">{contribution.categories}</p>}
            <div className="user-card-footer">
              <span className="designer-pattern-count">{contribution.audience || "—"}</span>
              <div className="pattern-actions">{renderActions(contribution)}</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
