import type { DesignerAdapter } from "./types"
import { patternsForPiratesAdapter } from "./adapters/patterns-for-pirates"
import { jalieAdapter } from "./adapters/jalie"
import { greenstyleCreationsAdapter } from "./adapters/greenstyle-creations"
import { fibreMoodAdapter } from "./adapters/fibre-mood"
import { seamworkAdapter } from "./adapters/seamwork"
import { violetteFieldThreadsAdapter } from "./adapters/violette-field-threads"
import { grasserAdapter } from "./adapters/grasser"
import { peekabooPatternShopAdapter } from "./adapters/peekaboo-pattern-shop"
import { ellieAndMacAdapter } from "./adapters/ellie-and-mac"
import { fiveOutOfFourAdapter } from "./adapters/five-out-of-four"
import { brindilleAndTwigAdapter } from "./adapters/brindille-and-twig"
import { booAndLuAdapter } from "./adapters/boo-and-lu"
import { folkwearAdapter } from "./adapters/folkwear"
import { sinclairPatternsAdapter } from "./adapters/sinclair-patterns"
import { loveNotionsAdapter } from "./adapters/love-notions"
import { itchToStitchAdapter } from "./adapters/itch-to-stitch"
import { iAmPatternsAdapter } from "./adapters/i-am-patterns"
import { georgeAndGingerAdapter } from "./adapters/george-and-ginger"
import { atelierBrunetteAdapter } from "./adapters/atelier-brunette"
import { ottobreAdapter } from "./adapters/ottobre"
import { greenPepperAdapter } from "./adapters/green-pepper"
import { wardrobeByMeAdapter } from "./adapters/wardrobe-by-me"
import { baraStudioAdapter } from "./adapters/bara-studio"
import { lieslAndCoAdapter } from "./adapters/liesl-and-co"
import { oliverAndSAdapter } from "./adapters/oliver-and-s"
import { moodFabricsAdapter } from "./adapters/mood-fabrics"
import { atelierJupeAdapter } from "./adapters/atelier-jupe"
import { emporiaAdapter } from "./adapters/emporia"
import { experimentalSpaceAdapter } from "./adapters/experimental-space"
import { elemenoPatternsAdapter } from "./adapters/elemeno-patterns"
import { atelierScammitAdapter } from "./adapters/atelier-scammit"

// Adding support for another designer means writing one adapter file and adding
// it to this list. No route or UI changes required.
export const ADAPTERS: DesignerAdapter[] = [
  patternsForPiratesAdapter,
  jalieAdapter,
  greenstyleCreationsAdapter,
  fibreMoodAdapter,
  seamworkAdapter,
  violetteFieldThreadsAdapter,
  grasserAdapter,
  peekabooPatternShopAdapter,
  ellieAndMacAdapter,
  fiveOutOfFourAdapter,
  brindilleAndTwigAdapter,
  booAndLuAdapter,
  folkwearAdapter,
  sinclairPatternsAdapter,
  loveNotionsAdapter,
  itchToStitchAdapter,
  iAmPatternsAdapter,
  georgeAndGingerAdapter,
  atelierBrunetteAdapter,
  ottobreAdapter,
  greenPepperAdapter,
  wardrobeByMeAdapter,
  baraStudioAdapter,
  lieslAndCoAdapter,
  oliverAndSAdapter,
  moodFabricsAdapter,
  atelierJupeAdapter,
  emporiaAdapter,
  experimentalSpaceAdapter,
  elemenoPatternsAdapter,
  atelierScammitAdapter,
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
