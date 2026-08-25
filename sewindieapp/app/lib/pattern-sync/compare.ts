import type { ScrapedPattern } from "./types"

// Deciding whether a scraped product is genuinely new is the part most likely to
// get it wrong in both directions: miss a real pattern, or create a duplicate.
// The URL is treated as identity, with a normalized-name fallback that reports
// "possible match" instead of asserting either answer.

export type MatchStatus = "NEW" | "POSSIBLE_MATCH" | "EXISTING"

export type ExistingPattern = {
  id: number
  name: string
  url: string | null
}

export type ComparedPattern = ScrapedPattern & {
  status: MatchStatus
  /** Set for POSSIBLE_MATCH / EXISTING so the admin can see what it collided with. */
  matchedPattern: { id: number; name: string } | null
}

export type CompareSummary = {
  found: number
  new: number
  possibleMatches: number
  existing: number
}

/**
 * Canonical form of a URL for identity checks: lowercase host without `www.`,
 * no trailing slash, no query string or fragment. Query params on WooCommerce
 * product links are tracking noise, not identity.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withScheme)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    return `${host}${path}`
  } catch {
    return null
  }
}

/**
 * Loose form of a name for fallback matching. Strips punctuation and dashes so
 * "Picnic Dress- Youth" and "Picnic Dress – Youth" collapse together, while
 * "Picnic Dress" stays distinct from "Picnic Dress Youth".
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function comparePatterns(
  scraped: ScrapedPattern[],
  existing: ExistingPattern[],
): { rows: ComparedPattern[]; summary: CompareSummary } {
  const byUrl = new Map<string, ExistingPattern>()
  const byName = new Map<string, ExistingPattern>()

  for (const pattern of existing) {
    const url = normalizeUrl(pattern.url)
    if (url && !byUrl.has(url)) byUrl.set(url, pattern)

    const name = normalizeName(pattern.name)
    if (name && !byName.has(name)) byName.set(name, pattern)
  }

  // Guards against a store listing the same product twice across pages.
  const seenInFeed = new Set<string>()
  const rows: ComparedPattern[] = []

  for (const item of scraped) {
    const url = normalizeUrl(item.url)
    if (url) {
      if (seenInFeed.has(url)) continue
      seenInFeed.add(url)
    }

    const urlHit = url ? byUrl.get(url) : undefined
    if (urlHit) {
      rows.push({ ...item, status: "EXISTING", matchedPattern: { id: urlHit.id, name: urlHit.name } })
      continue
    }

    const nameHit = byName.get(normalizeName(item.name))
    if (nameHit) {
      // Same name, different URL. Could be a pattern added earlier under an old
      // link, or a genuinely different product that happens to share a name --
      // so surface it for a human instead of guessing.
      rows.push({ ...item, status: "POSSIBLE_MATCH", matchedPattern: { id: nameHit.id, name: nameHit.name } })
      continue
    }

    rows.push({ ...item, status: "NEW", matchedPattern: null })
  }

  // Standalone patterns first, then newest-first within each group, so bundles
  // and add-ons never push a genuinely new pattern below the fold.
  rows.sort((a, b) => {
    const aside = a.kind === "pattern" ? 0 : 1
    const bside = b.kind === "pattern" ? 0 : 1
    if (aside !== bside) return aside - bside
    return (b.releaseDate ?? "").localeCompare(a.releaseDate ?? "")
  })

  return {
    rows,
    summary: {
      found: rows.length,
      new: rows.filter((r) => r.status === "NEW").length,
      possibleMatches: rows.filter((r) => r.status === "POSSIBLE_MATCH").length,
      existing: rows.filter((r) => r.status === "EXISTING").length,
    },
  }
}
