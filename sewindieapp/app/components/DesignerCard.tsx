import React from "react"
import Link from "next/link"
import DesignerLogo from "./DesignerLogo"

type DesignerCardProps = {
  id: number
  name: string
  logo_url: string | null
  patternCount: number
}

/**
 * Grid card for the designers index, mirroring PatternCard's shell (white
 * surface, hairline border, lift on hover) so the two browse pages read as one
 * system. Replaces the Bootstrap `.card` markup this used before.
 */
export default function DesignerCard({ id, name, logo_url, patternCount }: DesignerCardProps) {
  if (!id || !name) {
    console.error("Invalid designer data:", { id, name })
    return null
  }

  return (
    <article className="dcard">
      <Link href={`/designers/${id}`} className="dcard-media" aria-label={name}>
        <DesignerLogo
          name={name}
          logoUrl={logo_url}
          variant="card"
          sizes="(min-width: 1200px) 20vw, (min-width: 992px) 25vw, (min-width: 576px) 50vw, 100vw"
        />
      </Link>
      <div className="dcard-body">
        <h3 className="dcard-name">
          <Link href={`/designers/${id}`}>{name}</Link>
        </h3>
        <p className="dcard-count">
          {patternCount.toLocaleString()} {patternCount === 1 ? "pattern" : "patterns"}
        </p>
      </div>
    </article>
  )
}
