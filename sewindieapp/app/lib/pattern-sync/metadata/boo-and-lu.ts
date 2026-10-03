import { CATEGORY_RULES, matchWord } from "./grasser"
import { type ExtractedMetadata, type UnmatchedTerm, emptyMetadata } from "./types"

// Boo and Lu (booandlu.com) metadata extraction.
//
// WooCommerce's `product_cat` tree is the structured signal: audience branches
// (children's > girl/boy, baby > baby-girl/baby-boy, adult, juniors) with
// garment leaves under each. Singles and bundles both carry it, so bundles are
// enriched too (owner decision) and simply collect every leaf they span.
//
//   * category   -- garment leaf slug. "Bottoms" and "Adult Bodysuits & Swim"
//                   span several categories, so for those (or when no leaf
//                   maps) the pattern name decides via the shared Grasser rules.
//   * audience   -- girl -> Girls, boy -> Boys, baby-girl -> Baby + Girls,
//                   baby-boy -> Baby + Boys, adult -> Women (owner decisions);
//                   children's/juniors with no gender branch -> Children.
//   * difficulty -- not published (a handful of descriptions mention it in
//                   prose), so not extracted. Same for fabric dimensions.

const EXACT_LEAF: Record<string, string> = {
  "accessories-sewing-patterns": "Accessories",
  "hair-accessories": "Accessories",
  bags: "Bag / Tote",
  hats: "Beanie / Hat",
  play: "Costume",
  applique: "Add-on",
  home: "Other",
}

const COARSE_LEAF = /bottoms|bodysuits-swim/

const LEAF_PATTERNS: Array<[pattern: RegExp, category: string]> = [
  [/leotard/, "Unitard / Leotard"],
  [/romper/, "Onesies / Rompers"],
  [/sleepwear/, "Sleepwear / Pajama"],
  [/swim/, "Swimwear"],
  [/dress/, "Dress"],
  [/(^|-)tops(-|$)/, "Tops"],
  [/outerwear/, "Coat / Jacket"],
]

function leafCategory(slug: string): string | null {
  if (EXACT_LEAF[slug]) return EXACT_LEAF[slug]
  if (COARSE_LEAF.test(slug)) return null
  return LEAF_PATTERNS.find(([pattern]) => pattern.test(slug))?.[1] ?? null
}

function audiencesFor(slugs: Set<string>): string[] {
  const out = new Set<string>()
  const has = (re: RegExp) => [...slugs].some((s) => re.test(s))

  const babyGirl = has(/(^|-)baby-girl$/)
  const babyBoy = has(/(^|-)baby-boy$/)
  if (babyGirl || babyBoy || slugs.has("baby")) out.add("Baby")
  if (babyGirl) out.add("Girls")
  if (babyBoy) out.add("Boys")

  if (slugs.has("girl") || has(/^girls-/)) out.add("Girls")
  if (slugs.has("boy") || has(/^boys-/)) out.add("Boys")
  if (slugs.has("adult-sewing-patterns") || has(/^adults?-/) || slugs.has("outerwear-adults")) out.add("Women")

  if (!out.has("Girls") && !out.has("Boys") && !out.has("Baby")) {
    if (slugs.has("childrens-sewing-patterns") || slugs.has("juniors")) out.add("Children")
  }
  return [...out]
}

/**
 * Many bundles carry only the `bundles` term, not the audience tree, but their
 * titles say who they're for ("Child & Adult ...", "Baby & Child ..."). Used
 * only when the tree yields nothing; same mappings as the tree.
 */
function audiencesFromName(name: string): string[] {
  const out = new Set<string>()
  if (/\bbaby\b/.test(name)) out.add("Baby")
  if (/\bgirls?\b/.test(name)) out.add("Girls")
  if (/\bboys?\b/.test(name)) out.add("Boys")
  if (/\b(child|children|kids?|toddler|tween)\b/.test(name) && !out.has("Girls") && !out.has("Boys")) {
    out.add("Children")
  }
  if (/\b(adults?|adult’s|adult's|women|women’s|women's|ladies)\b/.test(name)) out.add("Women")
  return [...out]
}

/**
 * Translate one Boo and Lu product into canonical SewIndie vocabulary names.
 * Pure and DB-free.
 *
 * @param slugs every product_cat slug on the product plus all their ancestors.
 */
export function extractBooAndLuMetadata(input: { name: string; slugs: string[] }): ExtractedMetadata {
  const meta = emptyMetadata()
  const unmatched: UnmatchedTerm[] = []
  const slugs = new Set(input.slugs)
  const name = (input.name || "").toLowerCase().trim()

  const categories = new Set<string>()
  let needsName = false
  for (const slug of slugs) {
    const cat = leafCategory(slug)
    if (cat) categories.add(cat)
    else if (COARSE_LEAF.test(slug)) needsName = true
  }
  if (needsName || categories.size === 0) {
    // Bundles often name several garments ("Top & Dress"), so collect every match.
    for (const [keyword, cat] of CATEGORY_RULES) {
      if (matchWord(name, keyword)) categories.add(cat)
    }
  }
  meta.categories = [...categories]
  if (categories.size === 0 && name) unmatched.push({ dimension: "category", term: name })

  meta.audiences = audiencesFor(slugs)
  if (meta.audiences.length === 0) meta.audiences = audiencesFromName(name)
  if (meta.audiences.length === 0 && name) unmatched.push({ dimension: "audience", term: name })

  meta.unmatched = unmatched
  return meta
}
