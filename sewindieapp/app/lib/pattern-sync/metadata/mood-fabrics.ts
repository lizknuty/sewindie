import { type ExtractedMetadata, type UnmatchedTerm, emptyMetadata } from "./types"

// Mood Sewciety (blog.moodfabrics.com) metadata extraction.
//
// Unlike Patterns for Pirates, Mood is a plain WordPress blog with NO tags --
// the only structured signal on a post is its category taxonomy. So this
// extractor works purely off category *slugs* (stable, unlike the display
// names) and maps them to three dimensions:
//
//   * category (garment)  -- the single-garment category buckets
//   * audience            -- only the special-audience buckets; everything else
//                            defaults to Women (see below)
//   * difficulty          -- the lone "Beginner Sewing Patterns" bucket
//
// Fabric type, suggested fabrics and attributes are intentionally NOT extracted:
// Mood exposes no structured source for them (the post body is free-text
// marketing prose whose "recommended fabrics" are Mood's own shop product
// names, not generic vocabulary), so any mapping would be guesswork.
//
// Combined garment buckets are handled per owner decision: "Pants & Shorts"
// fans out to Pants / Jeans + Short, "Shawl & Cardigan" maps to Sweater /
// Sweatshirt, and "Adaptive" / "Activewear & Athleisure" / "Suiting" map to
// dedicated category rows created for Mood. "Outfit & Ensemble" is ignored.
// Any other unrecognized bucket is still reported as `unmatched` for review.

// --- Category (garment) ----------------------------------------------------
// Slugs mapped to one or more SewIndie category rows. Most map to a single
// garment; a few combined Mood buckets fan out to multiple rows, and three
// buckets (adaptive / activewear / suiting) map to categories created
// specifically for Mood -- all owner-approved.
const CATEGORY_MAP: Record<string, string[]> = {
  "dress-patterns": ["Dress"],
  "shirt-patterns": ["Tops"],
  "outerwear-patterns": ["Coat / Jacket"],
  "skirt-patterns": ["Skirt"],
  "lingerie-patterns": ["Intimate Apparel"],
  "swimwear-patterns": ["Swimwear"],
  "accessory-patterns": ["Accessories"],
  "sleepwear-patterns": ["Sleepwear / Pajama"],
  "cosplay-patterns": ["Costume"],
  // Combined buckets fanned out to their constituent garment rows.
  "pants-shorts-patterns": ["Pants / Jeans", "Short"],
  "shawl-cardigan-patterns": ["Sweater / Sweatshirt"],
  // Categories created for Mood (owner-approved).
  "adaptive-patterns": ["Adaptive"],
  "active-wear-athleisure-patterns": ["Activewear"],
  "suiting-patterns": ["Suiting"],
}

// --- Audience --------------------------------------------------------------
// Gender-signaling categories that OVERRIDE the Women default. Mood only files
// non-women audiences explicitly; the default women's/adult majority carries no
// audience category at all (handled below).
const AUDIENCE_MAP: Record<string, string> = {
  "all-gender-patterns": "Unisex Adult",
  "menswear-unisex-patterns": "Men",
  "childrens-sewing-patterns": "Children",
}

// --- Difficulty ------------------------------------------------------------
// Mood's only skill signal. The structured "RECOMMENDED SEWING LEVEL:" marker
// exists solely in multi-pattern round-ups, never on single-pattern posts, so
// this category is the one usable per-pattern difficulty cue.
const DIFFICULTY_MAP: Record<string, string> = {
  "basic-sewing-patterns": "Beginner",
}

// Seasonal / marketing / structural buckets that are not metadata, plus the
// outfit/ensemble bucket the owner opted to skip. Dropped silently so the
// `unmatched` report stays focused on real candidates.
const IGNORE = new Set<string>([
  "outfit-ensemble-patterns",
  "free-sewing-patterns",
  "fall-sewing-patterns",
  "spring-sewing-patterns",
  "summer-sewing-patterns",
  "winter-sewing-patterns",
  "featured",
  "free-download",
  "website-updates",
  "home-decor",
  "ppe-patterns-tutorials",
  "minimal-waste-sewing-patterns",
  "pattern-roundup",
  "special-occasion-patterns",
])

/**
 * Translate a Mood post's category slugs into canonical SewIndie vocabulary
 * names. Pure and DB-free: the writer resolves the produced names against the
 * live vocabulary and reports anything missing.
 *
 * Audience rule: gender-signaling categories win; otherwise the pattern defaults
 * to Women (Mood's unmarked majority). Combined/unknown garment buckets and the
 * adaptive bucket are surfaced via `unmatched`.
 */
export function extractMoodMetadata(categorySlugs: string[]): ExtractedMetadata {
  const meta = emptyMetadata()
  const categories = new Set<string>()
  const genderAudiences = new Set<string>()
  const unmatched: UnmatchedTerm[] = []
  let difficulty: string | null = null

  for (const raw of categorySlugs) {
    const slug = raw.toLowerCase().trim()
    if (!slug || IGNORE.has(slug)) continue

    if (CATEGORY_MAP[slug]) {
      for (const name of CATEGORY_MAP[slug]) categories.add(name)
      continue
    }
    if (AUDIENCE_MAP[slug]) {
      genderAudiences.add(AUDIENCE_MAP[slug])
      continue
    }
    if (DIFFICULTY_MAP[slug]) {
      difficulty = DIFFICULTY_MAP[slug]
      continue
    }
    // Any other pattern-post category is a combined/ambiguous garment bucket
    // with no clean single-category target -- report it for review.
    unmatched.push({ dimension: "category", term: slug })
  }

  // Gender-signaling categories override the Women default; otherwise Mood's
  // unmarked majority is women's/adult.
  meta.audiences = genderAudiences.size > 0 ? [...genderAudiences] : ["Women"]
  meta.categories = [...categories]
  meta.difficulty = difficulty
  meta.unmatched = unmatched
  return meta
}
