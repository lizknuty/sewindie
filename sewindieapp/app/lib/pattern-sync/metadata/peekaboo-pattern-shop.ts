import { CATEGORY_RULES, matchWord } from "./grasser"
import { type ExtractedMetadata, type UnmatchedTerm, emptyMetadata } from "./types"

// Peek-A-Boo Pattern Shop (BigCommerce) metadata extraction.
//
// The store has no feed or tags, but it files every product into storefront
// categories, and membership in those categories is the structured signal:
//
//   * audience   -- women / men / girls / boys / baby+newborn+preemie (-> Baby)
//                   / maternity (-> Women only; owner decision). Union of all.
//   * category   -- pattern NAME keyword first (shared table with Grasser),
//                   falling back to the store's garment categories.
//   * difficulty -- only two buckets. Beginner, Intermediate; a product listed
//                   in both is treated as Beginner (owner decision).
//   * fabricType -- knit / woven; a product in both gets both.
//
// Suggested fabrics and attributes are not published in structured form.

export const PEEKABOO_AUDIENCE_CATEGORIES: Record<string, string> = {
  "sewing-patterns-for-women": "Women",
  "maternity-sewing-patterns": "Women",
  "sewing-patterns-for-men": "Men",
  "sewing-patterns-for-girls": "Girls",
  "boys-sewing-patterns": "Boys",
  "baby-sewing-patterns": "Baby",
  "newborn-sewing-patterns": "Baby",
  "preemie-sewing-patterns": "Baby",
}

export const PEEKABOO_SKILL_CATEGORIES = ["sewing-patterns-for-beginners", "intermediate-sewing-patterns"] as const

export const PEEKABOO_FABRIC_CATEGORIES: Record<string, string> = {
  "knit-sewing-patterns": "Knit",
  "woven-sewing-patterns": "Woven",
}

// Fallback only, most specific first. Top-level garment categories already
// contain their women's/girls'/boys' sub-categories, so those aren't crawled.
export const PEEKABOO_GARMENT_CATEGORIES: Array<[slug: string, category: string]> = [
  ["leotard-patterns", "Unitard / Leotard"],
  ["swimsuit-patterns", "Swimwear"],
  ["underwear-patterns", "Intimate Apparel"],
  ["pajama-patterns", "Sleepwear / Pajama"],
  ["girls-romper-pattern", "Onesies / Rompers"],
  ["boys-romper-sewing-pattern", "Onesies / Rompers"],
  ["hoodie-patterns", "Hoodie"],
  ["jacket-patterns", "Coat / Jacket"],
  ["outerwear", "Coat / Jacket"],
  ["dress-patterns", "Dress"],
  ["skirt-patterns", "Skirt"],
  ["shorts-patterns", "Short"],
  ["pants-patterns", "Pants / Jeans"],
  ["shirt-patterns", "Tops"],
  ["hat-patterns", "Beanie / Hat"],
  ["shoe-patterns", "Slippers / Booties"],
]

/** Every storefront category whose membership the adapter must crawl. */
export const PEEKABOO_SIGNAL_CATEGORIES: string[] = [
  ...Object.keys(PEEKABOO_AUDIENCE_CATEGORIES),
  ...PEEKABOO_SKILL_CATEGORIES,
  ...Object.keys(PEEKABOO_FABRIC_CATEGORIES),
  ...PEEKABOO_GARMENT_CATEGORIES.map(([slug]) => slug),
]

/**
 * Translate one Peek-A-Boo product into canonical SewIndie vocabulary names.
 * Pure and DB-free.
 *
 * @param storeCategories the storefront category slugs the product appears in,
 *        or null when the category crawl was incomplete -- then only the name
 *        drives category, and nothing else is inferred (absence from a
 *        half-crawled list proves nothing).
 */
export function extractPeekabooMetadata(input: { name: string; storeCategories: string[] | null }): ExtractedMetadata {
  const meta = emptyMetadata()
  const unmatched: UnmatchedTerm[] = []
  const name = (input.name || "").toLowerCase().trim()
  const cats = input.storeCategories ? new Set(input.storeCategories) : null

  let category: string | null = null
  for (const [keyword, cat] of CATEGORY_RULES) {
    if (matchWord(name, keyword)) {
      category = cat
      break
    }
  }
  if (!category && cats) {
    category = PEEKABOO_GARMENT_CATEGORIES.find(([slug]) => cats.has(slug))?.[1] ?? null
  }
  if (category) meta.categories = [category]
  else if (name) unmatched.push({ dimension: "category", term: name })

  if (cats) {
    meta.audiences = [
      ...new Set(
        Object.entries(PEEKABOO_AUDIENCE_CATEGORIES)
          .filter(([slug]) => cats.has(slug))
          .map(([, audience]) => audience),
      ),
    ]

    if (cats.has("sewing-patterns-for-beginners")) meta.difficulty = "Beginner"
    else if (cats.has("intermediate-sewing-patterns")) meta.difficulty = "Intermediate"

    meta.fabricTypes = Object.entries(PEEKABOO_FABRIC_CATEGORIES)
      .filter(([slug]) => cats.has(slug))
      .map(([, fabric]) => fabric)
  }

  meta.unmatched = unmatched
  return meta
}
