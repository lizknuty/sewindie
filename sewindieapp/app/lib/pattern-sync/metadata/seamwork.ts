import { CATEGORY_RULES, matchWord } from "./grasser"
import { type ExtractedMetadata, type UnmatchedTerm, emptyMetadata } from "./types"

// Seamwork (seamwork.com) metadata extraction.
//
// Seamwork has no feed or tags. Its catalogue index exposes filter listings at
// /pdf-sewing-patterns/filters/<filter> -- 10 garment filters and 4 skill
// filters -- and a pattern's membership in those listings is the structured
// signal. Every pattern sits in at least one garment filter and exactly one
// skill filter.
//
//   * category   -- pattern NAME keyword first (shared table with Grasser);
//                   the garment filters are coarse ("bottoms" covers pants,
//                   skirts and shorts), so they are only a fallback, and only
//                   the unambiguous ones map (owner decision).
//   * audience   -- "gender-neutral" filter -> Unisex Adult, everything else
//                   -> Women (Seamwork is womenswear; owner decision).
//   * difficulty -- the skill filter, on the same text scale used for Grasser.
//
// Fabric type, suggested fabrics and attributes are not published in any
// structured form, so they are not extracted (same call as Mood / P4P / Grasser).

export const SEAMWORK_GARMENT_FILTERS = [
  "tops",
  "bottoms",
  "dresses",
  "jumpsuits",
  "sweaters",
  "outerwear",
  "loungewear-activewear",
  "swimwear-lingerie",
  "gender-neutral",
  "accessories",
] as const

export const SEAMWORK_SKILL_FILTERS = ["beginner", "advanced-beginner", "intermediate", "advanced"] as const

const DIFFICULTY_BY_SKILL: Record<string, string> = {
  beginner: "Beginner",
  "advanced-beginner": "Advanced Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
}

// Fallback only, in priority order (most specific first). "bottoms",
// "swimwear-lingerie", "accessories" and "gender-neutral" are deliberately
// absent: each spans several categories, so they never imply one.
const FILTER_FALLBACK: Array<[filter: string, category: string]> = [
  ["jumpsuits", "Jumpsuit"],
  ["dresses", "Dress"],
  ["outerwear", "Coat / Jacket"],
  ["sweaters", "Sweater / Sweatshirt"],
  ["tops", "Tops"],
  ["loungewear-activewear", "Activewear"],
]

/**
 * Translate one Seamwork pattern into canonical SewIndie vocabulary names.
 * Pure and DB-free.
 *
 * @param garments garment filter slugs the pattern appears in, or null when the
 *                 filter listings were not crawled (name-only enrichment then:
 *                 no audience, no difficulty, no filter fallback -- a missing
 *                 "gender-neutral" must never be read as "Women").
 * @param skills   skill filter slugs the pattern appears in (null as above).
 */
export function extractSeamworkMetadata(input: {
  name: string
  garments: string[] | null
  skills: string[] | null
}): ExtractedMetadata {
  const meta = emptyMetadata()
  const unmatched: UnmatchedTerm[] = []
  const name = (input.name || "").toLowerCase().trim()
  const garments = input.garments

  let category: string | null = null
  for (const [keyword, cat] of CATEGORY_RULES) {
    if (matchWord(name, keyword)) {
      category = cat
      break
    }
  }
  if (!category && garments) {
    category = FILTER_FALLBACK.find(([filter]) => garments.includes(filter))?.[1] ?? null
  }
  if (category) {
    meta.categories = [category]
  } else if (name) {
    unmatched.push({ dimension: "category", term: name })
  }

  if (garments) {
    meta.audiences = garments.includes("gender-neutral") ? ["Unisex Adult"] : ["Women"]
  }

  const skill = input.skills?.find((s) => DIFFICULTY_BY_SKILL[s])
  if (skill) meta.difficulty = DIFFICULTY_BY_SKILL[skill]

  meta.unmatched = unmatched
  return meta
}
