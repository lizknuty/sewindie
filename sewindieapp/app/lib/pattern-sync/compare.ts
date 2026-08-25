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
 *
 * The one exception is Shopify's `variant` param, which is kept. Some stores
 * sell one product with Paper/Digital variants where the catalogue wants a row
 * per format, so `?variant=` is the only thing telling those rows apart. Every
 * other param is still dropped, so tracking noise can't fragment identity.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withScheme)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    const variant = parsed.searchParams.get("variant")?.trim()
    return variant ? `${host}${path}?variant=${variant.toLowerCase()}` : `${host}${path}`
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

/**
 * Optional per-adapter identity override.
 *
 * Most stores keep a product at one stable URL, so the URL *is* the identity.
 * A few don't: Grasser serves the same pattern under several category paths and
 * has since changed which one is canonical, so its stored URLs are split across
 * two forms that both refer to one pattern. For stores like that an adapter can
 * supply a narrower key -- the URL's final slug -- which stays stable while the
 * surrounding path moves.
 *
 * Returning null falls back to the normal URL then name matching.
 */
export type IdentityKeyFn = (url: string | null | undefined) => string | null

export function comparePatterns(
  scraped: ScrapedPattern[],
  existing: ExistingPattern[],
  options: { identityKey?: IdentityKeyFn } = {},
): { rows: ComparedPattern[]; summary: CompareSummary } {
  const { identityKey } = options
  const byIdentity = new Map<string, ExistingPattern>()
  const byUrl = new Map<string, ExistingPattern>()
  const byName = new Map<string, ExistingPattern>()
  // Some catalogue rows were saved by an older import that cut the name off,
  // leaving a literal "..." behind ("Amelia Jumpsuit Digital..."). Those can
  // never match by exact name, so without this the same design would come back
  // as brand new and quietly duplicate the row. Longest prefix wins so the most
  // specific truncated row is the one reported.
  const truncated: { prefix: string; pattern: ExistingPattern }[] = []

  for (const pattern of existing) {
    const identity = identityKey?.(pattern.url) ?? null
    if (identity && !byIdentity.has(identity)) byIdentity.set(identity, pattern)

    const url = normalizeUrl(pattern.url)
    if (url && !byUrl.has(url)) byUrl.set(url, pattern)

    const name = normalizeName(pattern.name)
    if (name && !byName.has(name)) byName.set(name, pattern)

    const trimmedName = pattern.name.trim()
    if (/(?:\.{3}|\u2026)$/.test(trimmedName)) {
      const prefix = normalizeName(trimmedName.replace(/(?:\.{3}|\u2026)+$/, ""))
      // Short prefixes would swallow unrelated patterns, so require some length.
      if (prefix.length >= 8) truncated.push({ prefix, pattern })
    }
  }
  truncated.sort((a, b) => b.prefix.length - a.prefix.length)

  // Guards against a store listing the same product twice across pages.
  const seenInFeed = new Set<string>()
  const rows: ComparedPattern[] = []

  for (const item of scraped) {
    const url = normalizeUrl(item.url)
    const identity = identityKey?.(item.url) ?? null

    // Dedupe on whichever key this store treats as identity. Using the identity
    // key here matters as much as it does for matching: Grasser links the same
    // pattern from several category paths, so URL-only deduping would let one
    // pattern through twice under different paths.
    const feedKey = identity ? `id:${identity}` : url
    if (feedKey) {
      if (seenInFeed.has(feedKey)) continue
      seenInFeed.add(feedKey)
    }

    const identityHit = identity ? byIdentity.get(identity) : undefined
    const urlHit = identityHit ?? (url ? byUrl.get(url) : undefined)
    if (urlHit) {
      rows.push({ ...item, status: "EXISTING", matchedPattern: { id: urlHit.id, name: urlHit.name } })
      continue
    }

    const scrapedName = normalizeName(item.name)
    const nameHit =
      byName.get(scrapedName) ?? truncated.find((entry) => scrapedName.startsWith(entry.prefix))?.pattern
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
