import { type ExtractedMetadata, type UnmatchedTerm, emptyMetadata } from "./types"

// Grasser (grasser.us) metadata extraction.
//
// Grasser is a Bitrix HTML store with no feed, no tags, and no useful taxonomy
// on the listing cards. Three signals drive enrichment:
//
//   * category (garment)  -- derived from the pattern NAME. The site's own
//                            itemprop=category is blank ("ALL PATTERNS") for
//                            ~370 items, so the name's garment noun is the far
//                            better source and is used as the primary signal.
//                            The itemprop leaf is only a fallback when the name
//                            matches nothing.
//   * audience            -- itemprop prefix ("WOMEN'S PATTERNS" / "KID'S
//                            PATTERNS") plus explicit name cues (men's, boy,
//                            girl, baby); everything else defaults to Women
//                            (Grasser is a womenswear company -- owner decision).
//   * difficulty          -- the detail page's numeric "N/5", mapped to a
//                            5-level text scale (owner-approved, see below).
//
// Fabric type, suggested fabrics and attributes are intentionally NOT extracted:
// the only source is the free-text "Materials for sewing" prose, which is
// unstructured recommendation text (same call as Mood / P4P).

// --- Category (garment) ----------------------------------------------------
// Ordered keyword -> category rules. ORDER MATTERS: more specific compounds are
// listed before the generic noun they contain, so e.g. "swimsuit top" resolves
// to Swimwear (not Tops) and "turtleneck sweater" to Sweater / Sweatshirt (not
// Tops). "sweatshirt" MUST precede "shirt" (it contains it). The first rule
// whose keyword appears as a whole word in the name wins -- one primary garment
// per pattern, mirroring the leading-noun analysis. Unmatched names are reported.
const CATEGORY_RULES: Array<[keyword: string, category: string]> = [
  // One-piece / suits (before the garment nouns they may contain).
  ["swimsuit", "Swimwear"],
  ["swimwear", "Swimwear"],
  ["bodysuit", "Bodysuit"],
  ["leotard", "Unitard / Leotard"],
  ["unitard", "Unitard / Leotard"],
  ["jumpsuit", "Jumpsuit"],
  ["romper", "Onesies / Rompers"],
  ["onesie", "Onesies / Rompers"],
  ["overalls", "Overalls / Coveralls"],
  ["overall", "Overalls / Coveralls"],
  ["coverall", "Overalls / Coveralls"],
  ["dungarees", "Overalls / Coveralls"],
  // Dresses.
  ["pinafore", "Dress"],
  ["sundress", "Dress"],
  ["dress", "Dress"],
  // Outerwear.
  ["raincoat", "Coat / Jacket"],
  ["trenchcoat", "Coat / Jacket"],
  ["trench", "Coat / Jacket"],
  ["parka", "Coat / Jacket"],
  ["bomber", "Coat / Jacket"],
  ["blazer", "Coat / Jacket"],
  ["coat", "Coat / Jacket"],
  ["jacket", "Coat / Jacket"],
  // Sweaters / knits (before "shirt" via sweatshirt, and before "top").
  ["hoodie", "Hoodie"],
  ["sweatshirt", "Sweater / Sweatshirt"],
  ["sweater", "Sweater / Sweatshirt"],
  ["jumper", "Sweater / Sweatshirt"],
  ["cardigan", "Sweater / Sweatshirt"],
  ["pullover", "Sweater / Sweatshirt"],
  // Bottoms.
  ["leggings", "Leggings"],
  ["joggers", "Joggers / Sweatpants"],
  ["sweatpants", "Joggers / Sweatpants"],
  ["shorts", "Short"],
  ["trousers", "Pants / Jeans"],
  ["jeans", "Pants / Jeans"],
  ["pants", "Pants / Jeans"],
  ["skort", "Skort"],
  ["skirt", "Skirt"],
  // Tops (generic; after all the compounds above).
  ["blouse", "Tops"],
  ["t-shirt", "Tops"],
  ["tshirt", "Tops"],
  ["longsleeve", "Tops"],
  ["turtleneck", "Tops"],
  ["tunic", "Tops"],
  ["shirt", "Tops"],
  ["top", "Tops"],
  ["waistcoat", "Vest"],
  ["vest", "Vest"],
  // Accessories / other.
  ["beanie", "Beanie / Hat"],
  ["cap", "Beanie / Hat"],
  ["hat", "Beanie / Hat"],
  ["poncho", "Poncho"],
  ["dressing gown", "Robe"],
  ["robe", "Robe"],
  ["pajama", "Sleepwear / Pajama"],
  ["pyjama", "Sleepwear / Pajama"],
  ["nightgown", "Sleepwear / Pajama"],
  ["panties", "Intimate Apparel"],
  ["lingerie", "Intimate Apparel"],
  ["socks", "Socks / Tights"],
  ["tights", "Socks / Tights"],
  ["slippers", "Slippers / Booties"],
  ["booties", "Slippers / Booties"],
  ["backpack", "Bag / Tote"],
  ["tote", "Bag / Tote"],
]

// itemprop leaf -> category, used ONLY as a fallback when the name matches no
// keyword. Kept to the unambiguous single-garment leaves the site publishes.
const LEAF_FALLBACK: Record<string, string> = {
  dresses: "Dress",
  skirts: "Skirt",
  blouses: "Tops",
  "t-shirts, tops": "Tops",
  jackets: "Coat / Jacket",
  coats: "Coat / Jacket",
  "trousers, shorts": "Pants / Jeans",
}

// --- Difficulty ------------------------------------------------------------
// Grasser's numeric N/5 mapped to a 5-level text scale (owner-approved).
const DIFFICULTY_BY_LEVEL: Record<number, string> = {
  1: "Beginner",
  2: "Advanced Beginner",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
}

// --- Audience --------------------------------------------------------------
// Explicit name cues override the itemprop prefix. Regexes use word boundaries
// so "men" does not fire on "women" and "cap" does not fire on "escape" etc.
const NAME_AUDIENCE_RULES: Array<[re: RegExp, audience: string]> = [
  [/\bmen(?:'s)?\b/, "Men"],
  [/\bboys?\b/, "Boys"],
  [/\bgirls?\b/, "Girls"],
  [/\bbab(?:y|ies)\b/, "Baby"],
  [/\b(?:kid'?s?|child(?:ren)?|toddler)\b/, "Children"],
]

function matchWord(haystack: string, keyword: string): boolean {
  // Whole-word / whole-token match. Escapes regex metachars in the keyword and
  // treats hyphens as internal so "t-shirt" matches correctly.
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(haystack)
}

/**
 * Translate one Grasser product into canonical SewIndie vocabulary names.
 * Pure and DB-free: the writer resolves the produced names against the live
 * vocabulary and reports anything missing.
 *
 * @param name         product name (from the listing) -- primary garment signal
 * @param categoryPath itemprop=category content, e.g.
 *                     "WOMEN'S PATTERNS/Patterns of outerwear/Jackets" (or null)
 * @param difficulty   detail-page rating 1..5 (or null when not published)
 */
export function extractGrasserMetadata(input: {
  name: string
  categoryPath: string | null
  difficulty: number | null
}): ExtractedMetadata {
  const meta = emptyMetadata()
  const unmatched: UnmatchedTerm[] = []
  const name = (input.name || "").toLowerCase().trim()

  // --- Category: name keyword (primary), itemprop leaf (fallback) ----------
  let category: string | null = null
  for (const [keyword, cat] of CATEGORY_RULES) {
    if (matchWord(name, keyword)) {
      category = cat
      break
    }
  }
  const segments = (input.categoryPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
  const leaf = segments.length > 0 ? segments[segments.length - 1].toLowerCase() : ""
  if (!category && LEAF_FALLBACK[leaf]) {
    category = LEAF_FALLBACK[leaf]
  }
  if (category) {
    meta.categories = [category]
  } else if (name) {
    unmatched.push({ dimension: "category", term: name })
  }

  // --- Audience: name cues > itemprop prefix > Women default ---------------
  const nameAudiences = new Set<string>()
  for (const [re, audience] of NAME_AUDIENCE_RULES) {
    if (re.test(name)) nameAudiences.add(audience)
  }
  if (nameAudiences.size > 0) {
    meta.audiences = [...nameAudiences]
  } else {
    const prefix = segments.length > 0 ? segments[0].toUpperCase() : ""
    if (prefix.startsWith("KID")) {
      meta.audiences = ["Children"]
    } else {
      // "WOMEN'S PATTERNS", "ALL PATTERNS", "Patterns for 50 Cents", or empty
      // all fall back to the womenswear default (owner decision).
      meta.audiences = ["Women"]
    }
  }

  // --- Difficulty ----------------------------------------------------------
  if (input.difficulty != null && DIFFICULTY_BY_LEVEL[input.difficulty]) {
    meta.difficulty = DIFFICULTY_BY_LEVEL[input.difficulty]
  }

  meta.unmatched = unmatched
  return meta
}
