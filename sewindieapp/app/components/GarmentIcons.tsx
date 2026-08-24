/**
 * Line-art garment glyphs for the pattern category tiles.
 *
 * These are hand-written inline SVGs because lucide-react 1.x ships no garment
 * icons beyond `shirt` (verified against the installed 1.31.0: no dress, pants,
 * skirt, coat, sweater or shorts export). They deliberately follow lucide's
 * drawing conventions -- 24x24 viewBox, no fill, 1.5 stroke, round caps and
 * joins, `currentColor` -- so they sit next to real lucide icons without
 * looking foreign, and inherit the tile's plum text colour.
 */

export type GarmentIconProps = {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  focusable: "false" as const,
})

/** Fitted bodice flaring into an A-line skirt. */
export function DressIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 3.5 6.5 5.5 8 9.5 5.5 20.5h13L16 9.5l1.5-4L15 3.5Z" />
      <path d="M9 3.5c1 2 5 2 6 0" />
      <path d="M8 9.5h8" />
    </svg>
  )
}

/** Short-sleeve tee, standing in for tops generally. */
export function TopIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8.5 3.5 4 6.5 6.5 10.5 8 9.5v11h8v-11l1.5 1L20 6.5l-4.5-3Z" />
      <path d="M8.5 3.5c1.1 2.5 5.9 2.5 7 0" />
    </svg>
  )
}

/** Waistband with two full-length legs. */
export function PantsIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7 3.5h10l1 17h-4.5L12 10l-1.5 10.5H6Z" />
      <path d="M7 6.5h10" />
    </svg>
  )
}

/** Open-front jacket with lapels and a centre placket. */
export function CoatIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 3.5 4.5 6 6.5 11 8 10v10.5h8V10l1.5 1L19.5 6 15 3.5Z" />
      <path d="M9 3.5 12 7l3-3.5" />
      <path d="M12 7v13.5" />
    </svg>
  )
}

/** A-line skirt with a waistband. */
export function SkirtIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 4.5h8l3 16H5Z" />
      <path d="M8 7.5h8" />
    </svg>
  )
}

/** Long-sleeve knit with a ribbed hem. */
export function SweaterIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 3.5 4.5 6 3 12l3 1 1-2.5v10h10v-10l1 2.5 3-1-1.5-6-4.5-2.5Z" />
      <path d="M9 3.5c1.1 2.5 4.9 2.5 6 0" />
      <path d="M7 18h10" />
    </svg>
  )
}

/**
 * Waistband with two cropped legs. Deliberately wider and much shorter than
 * PantsIcon -- at tile size the two silhouettes are otherwise near-identical.
 */
export function ShortsIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M6.5 5h11l1 9.5h-5.3L12 10.5l-1.2 4H5.5Z" />
      <path d="M6.5 8h11" />
    </svg>
  )
}

/** Bodice over trousers, for jumpsuits and rompers. */
export function JumpsuitIcon({ size = 24, className }: GarmentIconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M8 3.5h8l.5 17h-4L12 12l-.5 8.5h-4Z" />
      <path d="M8 9h8" />
    </svg>
  )
}
