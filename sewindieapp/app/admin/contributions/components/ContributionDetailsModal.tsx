"use client"

import { useEffect } from "react"
import { X, ExternalLink } from "lucide-react"
import type { PatternContribution } from "@/lib/google-sheets"
import ContributionStatusBadge from "./ContributionStatusBadge"

interface Props {
  contribution: PatternContribution
  onClose: () => void
}

export default function ContributionDetailsModal({ contribution, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const fields: { label: string; value: string }[] = [
    { label: "Designer", value: contribution.designer },
    { label: "Categories", value: contribution.categories },
    { label: "Audience", value: contribution.audience },
    { label: "Sizes", value: contribution.sizes },
    { label: "Publication Date", value: contribution.publicationDate },
    { label: "Price", value: contribution.price },
    { label: "Published in Print", value: contribution.publishedInPrint },
    { label: "Published Online", value: contribution.publishedOnline },
    { label: "Is Bundle", value: contribution.isBundle },
    { label: "Is Knit", value: contribution.isKnit },
    { label: "Is Woven", value: contribution.isWoven },
    { label: "Total Yardage", value: contribution.totalYardage },
    { label: "Suggested Fabrics", value: contribution.suggestedFabrics },
    { label: "Required Notions", value: contribution.requiredNotions },
  ]

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribution-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-modal-header">
          <div>
            <h2 className="admin-modal-title" id="contribution-modal-title">
              {contribution.name || "Untitled contribution"}
            </h2>
            <ContributionStatusBadge status={contribution.status} />
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </header>

        <div className="admin-modal-body">
          <dl className="contribution-detail-grid">
            {fields.map((field) => (
              <div className="contribution-detail" key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value?.trim() ? field.value : "—"}</dd>
              </div>
            ))}
          </dl>

          {contribution.patternUrl?.trim() && (
            <a
              className="designer-website-link contribution-modal-link"
              href={contribution.patternUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} />
              View pattern page
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
