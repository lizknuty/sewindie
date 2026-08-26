"use client"

import { useState } from "react"
import Image from "next/image"
import { initialsFor } from "@/lib/designer-initials"

/**
 * Rectangular designer logo tile with an initials fallback.
 *
 * Same failure handling as DesignerAvatar (logos are hotlinked from each
 * designer's own CDN, so some 404 or block hotlinking and next/image cannot
 * recover), but square-ish rather than a circle: these tiles show wordmarks,
 * which a circular crop cuts off.
 */
export default function DesignerLogo({
  name,
  logoUrl,
  variant,
  sizes,
}: {
  name: string
  logoUrl: string | null
  variant: "card" | "row"
  sizes: string
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(logoUrl) && !failed
  const prefix = variant === "card" ? "dcard" : "drow"

  return (
    <span className={`${prefix}-logo`}>
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt=""
          fill
          sizes={sizes}
          className={`${prefix}-logo-img`}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={`${prefix}-logo-initials`} aria-hidden="true">
          {initialsFor(name)}
        </span>
      )}
    </span>
  )
}
