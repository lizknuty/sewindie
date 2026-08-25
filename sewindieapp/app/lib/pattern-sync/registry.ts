import type { DesignerAdapter } from "./types"
import { patternsForPiratesAdapter } from "./adapters/patterns-for-pirates"
import { jalieAdapter } from "./adapters/jalie"
import { greenstyleCreationsAdapter } from "./adapters/greenstyle-creations"
import { fibreMoodAdapter } from "./adapters/fibre-mood"

// Adding support for another designer means writing one adapter file and adding
// it to this list. No route or UI changes required.
export const ADAPTERS: DesignerAdapter[] = [
  patternsForPiratesAdapter,
  jalieAdapter,
  greenstyleCreationsAdapter,
  fibreMoodAdapter,
]

/** Bare hostname, lowercased and stripped of `www.`, or null if unparseable. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const raw = url.trim()
    // Designer URLs in the DB aren't guaranteed to carry a scheme.
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return null
  }
}

/**
 * Finds the adapter responsible for a designer, matching on the hostname of
 * their store URL. Hostname rather than designer id so this keeps working
 * across environments with different database contents.
 */
export function getAdapterForDesigner(designer: { url: string | null }): DesignerAdapter | null {
  const host = hostOf(designer.url)
  if (!host) return null

  return (
    ADAPTERS.find((adapter) => adapter.matchHosts.some((candidate) => candidate.replace(/^www\./, "") === host)) ?? null
  )
}

export function getAdapterBySlug(slug: string): DesignerAdapter | null {
  return ADAPTERS.find((adapter) => adapter.slug === slug) ?? null
}
