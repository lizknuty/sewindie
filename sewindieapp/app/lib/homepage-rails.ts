/**
 * Shared sizing for the two curated homepage rails.
 *
 * The public homepage (app/page.tsx) and the admin curation screen
 * (app/admin/homepage) both need these numbers, and they were briefly
 * duplicated — the admin said "6 slots" while the homepage actually loaded 10,
 * so the admin under-reported how many designers were on the page. Keep them
 * here so the two screens cannot drift apart again.
 */

/** Designers loaded into the "Featured Designers" rail. */
export const DESIGNER_SLOTS = 10

/** Patterns loaded into the "New & Noteworthy" rail. */
export const PATTERN_SLOTS = 12

/**
 * Designer cards visible per view. The rail is a horizontal scroller sized to
 * fit exactly six across on desktop, so slots 7-10 are one arrow press away
 * rather than hidden. See `.home-designer-item` in app/styles.css.
 *
 * The pattern rail has no equivalent: it is a 6-column grid that renders all
 * PATTERN_SLOTS at once, so every pinned pattern is immediately visible.
 */
export const DESIGNER_VISIBLE = 6
