"use client"

import Image from "next/image"
import { useState, type CSSProperties } from "react"

/**
 * Single source of truth for the fallback image.
 *
 * The file lives at `public/pattern-placeholder.png`, so it is served at
 * `/pattern-placeholder.png`. If you swap in a .jpg, change ONLY this line —
 * Next serves static files with a content type derived from the extension, so
 * the name here has to match the real file on disk.
 */
export const PATTERN_PLACEHOLDER = "/pattern-placeholder.png"

type PatternThumbnailProps = {
  src: string | null | undefined
  alt: string
  /** Fill the nearest positioned ancestor. Requires a sized parent. */
  fill?: boolean
  sizes?: string
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
  /**
   * Render a plain <img> instead of next/image, for call sites that rely on
   * intrinsic sizing (e.g. `h-auto`) where next/image would need fixed
   * dimensions it does not have.
   */
  raw?: boolean
}

/**
 * Pattern thumbnail with a fallback for dead external images.
 *
 * Nearly every pattern in the catalogue hotlinks its thumbnail from the
 * designer's own site, and those links rot. The previous
 * `thumbnail_url || "/placeholder.svg"` pattern could not catch that: it only
 * fires when the column is null or empty, and a rotted link is a perfectly
 * non-empty string. The image element has to actually try to load and fail, so
 * the fallback lives in onError and this must be a client component.
 */
export default function PatternThumbnail({
  src,
  alt,
  fill,
  sizes,
  width,
  height,
  className,
  style,
  raw,
}: PatternThumbnailProps) {
  // Track WHICH src failed rather than a boolean, so a re-render with a
  // different url retries instead of being stuck on the placeholder. List
  // components reuse these instances as their data changes.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const trimmed = src?.trim()
  const isMissing = !trimmed
  const hasFailed = trimmed !== undefined && failedSrc === trimmed
  const resolved = isMissing || hasFailed ? PATTERN_PLACEHOLDER : (trimmed as string)
  const isFallback = resolved === PATTERN_PLACEHOLDER

  // Decorative when showing the fallback: the alt text would otherwise
  // describe a pattern whose image is not actually on screen.
  const resolvedAlt = isFallback ? "" : alt

  function handleError() {
    if (trimmed) setFailedSrc(trimmed)
  }

  if (raw) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={resolvedAlt}
        className={className}
        style={style}
        onError={handleError}
      />
    )
  }

  const sharedProps = {
    src: resolved,
    alt: resolvedAlt,
    className,
    style,
    onError: handleError,
    // The local fallback is already small and correctly sized; sending it
    // through the optimizer adds a round trip for no benefit.
    ...(isFallback ? { unoptimized: true } : {}),
  }

  if (fill) {
    return <Image {...sharedProps} fill sizes={sizes} />
  }

  return <Image {...sharedProps} width={width ?? 300} height={height ?? 300} sizes={sizes} />
}
