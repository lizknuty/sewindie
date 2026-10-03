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

// Owner-approved garment cues the shared Grasser rules don't cover. There is no
// Loungewear category, so lounge sets go to the closest existing one.
const BOO_NAME_RULES: Array<[pattern: RegExp, category: string]> = [
  [/\b(swim\s?suit|swim|bikini|tankini|cover-?up)\b/, "Swimwear"],
  [/\btees?\b/, "Tops"],
  [/\bhoodies?\b/, "Hoodie"],
  [/\bpants\b/, "Pants / Jeans"],
  [/\bpettiskirts?\b/, "Skirt"],
  [/\b(storm|zip-?up)\b/, "Coat / Jacket"],
  [/\b(lounge|ember)\b/, "Sleepwear / Pajama"],
]

const ACCESSORY_SLUGS = new Set([
  "accessories-sewing-patterns",
  "hair-accessories",
  "bags",
  "hats",
  "play",
  "applique",
  "home",
])

/**
 * Owner-approved defaults when neither the tree nor the title names an
 * audience: "Complete" bundles span every size range (Women + Girls); kids'
 * accessories are Girls + Boys, except hair bows and scrunchies (Girls).
 */
function audienceDefaults(name: string, slugs: Set<string>): string[] {
  if (/\bcomplete\b/.test(name)) return ["Women", "Girls"]
  if ([...slugs].some((s) => ACCESSORY_SLUGS.has(s))) {
    return /\b(bows?|scrunchies?)\b/.test(name) ? ["Girls"] : ["Girls", "Boys"]
  }
  return []
}

const NON_DESIGN_WORDS = new Set([
  "baby", "babys", "child", "childs", "children", "childrens", "adult", "adults", "women", "womens",
  "girl", "girls", "boy", "boys", "kid", "kids", "toddler", "tween", "junior", "juniors", "b", "l",
  "basics", "complete", "the", "and", "sewing", "pattern", "patterns", "digital", "pdf", "bundle",
  "bundles", "set", "sizes", "top", "tops", "dress", "dresses", "tee", "swim", "suit",
])

function designWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !NON_DESIGN_WORDS.has(w))
}

type Enrichable = { name: string; kind: string; metadata?: ExtractedMetadata }

/**
 * Bundles whose only store category is "Bundles" say nothing about garment
 * type, but they are named after the single patterns they contain ("Baby &
 * Child Fawn Bundle" -> the Fawn single). Owner decision: such bundles take
 * the categories of their component singles, and when they still have no
 * audience, Girls (+ Boys if a component is a boys' pattern). Mutates in place
 * and only fills dimensions that are empty.
 */
export function inheritBundleMetadata(products: Enrichable[]): void {
  const byDesign = new Map<string, ExtractedMetadata[]>()
  for (const p of products) {
    if (p.kind !== "pattern" || !p.metadata) continue
    const key = designWords(p.name)[0]
    if (!key) continue
    byDesign.set(key, [...(byDesign.get(key) ?? []), p.metadata])
  }

  for (const p of products) {
    const meta = p.metadata
    if (p.kind !== "bundle" || !meta) continue
    const components = [...new Set(designWords(p.name))].flatMap((w) => byDesign.get(w) ?? [])

    if (meta.categories.length === 0 && components.length > 0) {
      meta.categories = [...new Set(components.flatMap((c) => c.categories))]
    }
    if (meta.audiences.length === 0) {
      const boys = components.some((c) => c.audiences.includes("Boys"))
      meta.audiences = boys ? ["Girls", "Boys"] : ["Girls"]
    }
    meta.unmatched = meta.unmatched.filter(
      (u) => !(u.dimension === "category" && meta.categories.length > 0) && !(u.dimension === "audience"),
    )
  }
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
    for (const [pattern, cat] of BOO_NAME_RULES) {
      if (pattern.test(name)) categories.add(cat)
    }
  }
  meta.categories = [...categories]
  if (categories.size === 0 && name) unmatched.push({ dimension: "category", term: name })

  meta.audiences = audiencesFor(slugs)
  if (meta.audiences.length === 0) meta.audiences = audiencesFromName(name)
  if (meta.audiences.length === 0) meta.audiences = audienceDefaults(name, slugs)
  if (meta.audiences.length === 0 && name) unmatched.push({ dimension: "audience", term: name })

  meta.unmatched = unmatched
  return meta
}
