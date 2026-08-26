import React from "react"
import Link from "next/link"
import DesignerLogo from "./DesignerLogo"

type DesignerListRowProps = {
  id: number
  name: string
  logo_url: string | null
  patternCount: number
}

/** List-view counterpart to DesignerCard, mirroring PatternListRow's layout. */
export default function DesignerListRow({ id, name, logo_url, patternCount }: DesignerListRowProps) {
  if (!id || !name) {
    console.error("Invalid designer data:", { id, name })
    return null
  }

  return (
    <article className="drow">
      <Link href={`/designers/${id}`} className="drow-media" aria-label={name}>
        <DesignerLogo name={name} logoUrl={logo_url} variant="row" sizes="120px" />
      </Link>

      <div className="drow-main">
        <h3 className="drow-name">
          <Link href={`/designers/${id}`}>{name}</Link>
        </h3>
        <p className="drow-count">
          {patternCount.toLocaleString()} {patternCount === 1 ? "pattern" : "patterns"}
        </p>
      </div>

      <Link href={`/designers/${id}`} className="drow-cta">
        View patterns
      </Link>
    </article>
  )
}
