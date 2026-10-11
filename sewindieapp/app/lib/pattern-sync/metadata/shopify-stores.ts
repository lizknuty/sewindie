import { CATEGORY_RULES, matchWord } from "./grasser"
import { type ExtractedMetadata, emptyMetadata } from "./types"

// Metadata extraction for the Shopify batch: Petite Stitchery, Jalie, Winslet's,
// Winter Wear Designs, Maison Fauve, Pattern Emporium, Violette Field Threads
// and Ellie and Mac. Fibre Mood is deliberately absent (no tags; owner decision).
//
// Owner-approved policy for this batch:
//   * category    -- pattern NAME keywords first (Grasser's table plus the extra
//                    nouns below; French rules for Maison Fauve), then each
//                    store's structured garment field as a fallback.
//   * audience    -- explicit name cues, else the store's structured audience
//                    (tags / product_type / handle prefix), else Women for the
//                    womenswear stores. Violette Field Threads and Ellie and Mac
//                    get NO default (mostly kids).
//   * fabricType  -- explicit knit/woven TAGS only, never description prose.
//                    A pattern tagged both gets both.
//   * difficulty  -- structured only: Maison Fauve `Niveau_*`, Jalie
//                    `complexity_*`, Pattern Emporium's "SKILL LEVEL:" line.
//                    Marketing words like "easy" / "beginner friendly" are ignored.

export type ShopifyStoreSlug =
  | "petite-stitchery"
  | "jalie"
  | "winslets"
  | "winter-wear-designs"
  | "maison-fauve"
  | "pattern-emporium"
  | "violette-field-threads"
  | "ellie-and-mac"

export type ShopifyMetadataInput = {
  /** Cleaned display name, as the adapter emits it. */
  name: string
  handle: string
  productType?: string | null
  tags?: string[] | null
  bodyHtml?: string | null
}

/** Lowercase, accent-folded, curly quotes straightened. */
export const fold = (value: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase()
    .trim()

// --- Category ----------------------------------------------------------------

// Checked BEFORE the Grasser table, so "swim top" is Swimwear, not Tops.
const PRIORITY_RULES: Array<[string, string]> = [
  ["bikini", "Swimwear"],
  ["tankini", "Swimwear"],
  ["rash guard", "Swimwear"],
  ["rashguard", "Swimwear"],
  ["boardshorts", "Swimwear"],
  ["swim", "Swimwear"],
]

// Checked AFTER the Grasser table, so "tank dress" stays Dress.
const EXTRA_RULES: Array<[string, string]> = [
  ["short", "Short"],
  ["bermuda", "Short"],
  ["culottes", "Pants / Jeans"],
  ["capris", "Pants / Jeans"],
  ["harem", "Pants / Jeans"],
  ["dungaree", "Overalls / Coveralls"],
  ["kaftan", "Dress"],
  ["caftan", "Dress"],
  ["tee", "Tops"],
  ["tank", "Tops"],
  ["cami", "Tops"],
  ["camisole", "Tops"],
  ["henley", "Tops"],
  ["polo", "Tops"],
  ["outerwear", "Coat / Jacket"],
  ["anorak", "Coat / Jacket"],
  ["shrug", "Shrug / Bolero"],
  ["bolero", "Shrug / Bolero"],
  ["bra", "Intimate Apparel"],
  ["bralette", "Intimate Apparel"],
  ["underwear", "Intimate Apparel"],
  ["undies", "Intimate Apparel"],
  ["briefs", "Intimate Apparel"],
  ["knickers", "Intimate Apparel"],
  ["undergarments", "Intimate Apparel"],
  ["sleepwear", "Sleepwear / Pajama"],
  ["loungewear", "Sleepwear / Pajama"],
  ["nightie", "Sleepwear / Pajama"],
  ["pjs", "Sleepwear / Pajama"],
  ["pj", "Sleepwear / Pajama"],
  ["dancewear", "Unitard / Leotard"],
  ["costume", "Costume"],
  ["bag", "Bag / Tote"],
  ["purse", "Bag / Tote"],
  ["scrunchie", "Accessories"],
  ["headband", "Accessories"],
  ["apron", "Accessories"],
  ["bib", "Accessories"],
]

// Maison Fauve names are French. Checked FIRST for that store only, because the
// English table maps "robe" to Robe while French "robe" means dress.
const FRENCH_RULES: Array<[string, string]> = [
  ["maillot de bain", "Swimwear"],
  ["combishort", "Jumpsuit"],
  ["combinaison", "Jumpsuit"],
  ["salopette", "Overalls / Coveralls"],
  ["robe", "Dress"],
  ["jupe", "Skirt"],
  ["pantalon", "Pants / Jeans"],
  ["jean", "Pants / Jeans"],
  ["manteau", "Coat / Jacket"],
  ["veste", "Coat / Jacket"],
  ["blouson", "Coat / Jacket"],
  ["sweat", "Sweater / Sweatshirt"],
  ["pull", "Sweater / Sweatshirt"],
  ["gilet", "Sweater / Sweatshirt"],
  ["chemisier", "Tops"],
  ["chemise", "Tops"],
  ["tunique", "Tops"],
  ["debardeur", "Tops"],
  ["tee-shirt", "Tops"],
  ["sac", "Bag / Tote"],
]

const BASE_RULES = [...PRIORITY_RULES, ...CATEGORY_RULES, ...EXTRA_RULES]
const FAUVE_RULES = [...FRENCH_RULES, ...BASE_RULES]

/** "dresses" -> "dress", "tops" -> "top"; leaves "dress" alone. */
function singularize(text: string): string {
  return text
    .split(/(\s+|[^a-z0-9'-])/)
    .map((word) => {
      if (word.length <= 3) return word
      if (word.endsWith("sses")) return word.slice(0, -2)
      if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
      return word
    })
    .join("")
}

export function matchCategory(text: string, rules = BASE_RULES): string | null {
  const folded = fold(text)
  if (!folded) return null
  for (const variant of [folded, singularize(folded)]) {
    for (const [keyword, category] of rules) {
      if (matchWord(variant, keyword)) return category
    }
  }
  return null
}

const tagsOf = (input: ShopifyMetadataInput) => (input.tags ?? []).map((t) => t.trim()).filter(Boolean)

/** Structured garment text per store, used only when the name matches nothing. */
function structuredGarmentTexts(store: ShopifyStoreSlug, input: ShopifyMetadataInput): string[] {
  const type = (input.productType ?? "").trim()
  const tags = tagsOf(input)
  switch (store) {
    case "winslets":
    case "winter-wear-designs":
      return type ? [type] : []
    case "pattern-emporium":
      // "Womens Top", "Baby & Toddler Jeans" -> drop the audience words.
      return type ? [type.replace(/\b(?:womens|girls|boys|kids|baby|toddler)\b/gi, " ")] : []
    case "jalie":
      // Subtype is more specific than type: "sub-fp_T-shirts and stretch fabric tops".
      return [
        ...tags.filter((t) => /^sub(?:-[a-z]+)?_/i.test(t)),
        ...tags.filter((t) => /^type(?:-[a-z]+)?_/i.test(t)),
      ].map((t) => t.replace(/^[^_]*_/, ""))
    case "violette-field-threads":
      // "girls- dress", "doll- outerwear" -> the garment after the dash.
      return tags.filter((t) => /^[a-z]+-\s*\S/i.test(t)).map((t) => t.replace(/^[a-z]+-\s*/i, ""))
    default:
      return []
  }
}

// --- Audience ----------------------------------------------------------------

const NAME_AUDIENCE_RULES: Array<[RegExp, string]> = [
  [/\b(?:women'?s?|ladies|misses|femmes?)\b/, "Women"],
  [/\b(?:men'?s?|hommes?)\b/, "Men"],
  [/\bunisex\b/, "Unisex Adult"],
  [/\bboys?\b/, "Boys"],
  [/\bgirls?\b/, "Girls"],
  [/\b(?:bab(?:y|ies)|infants?|newborns?|preemies?|bebes?)\b/, "Baby"],
  [/\b(?:kids?|child(?:ren)?|toddlers?|tweens?|teens?|enfants?)\b/, "Children"],
  [/\bdolls?\b/, "Doll"],
]

function nameAudiences(name: string): Set<string> {
  const folded = fold(name)
  const found = new Set<string>()
  for (const [re, audience] of NAME_AUDIENCE_RULES) if (re.test(folded)) found.add(audience)
  // "(Adult)" / "Adult Kai" means Women unless the name already says men/unisex.
  if (/\badults?\b/.test(folded) && !found.has("Men") && !found.has("Unisex Adult")) found.add("Women")
  return found
}

const lowerTags = (input: ShopifyMetadataInput) => new Set(tagsOf(input).map((t) => fold(t)))

function structuredAudiences(store: ShopifyStoreSlug, input: ShopifyMetadataInput): Set<string> {
  const out = new Set<string>()
  const tags = lowerTags(input)
  const has = (...values: string[]) => values.some((v) => tags.has(v))

  switch (store) {
    case "jalie":
      for (const tag of tags) {
        if (tag.startsWith("gender_women")) out.add("Women")
        else if (tag.startsWith("gender_men")) out.add("Men")
        else if (tag === "gender_kids & teens") out.add("Children")
        else if (tag === "gender_babies") out.add("Baby")
        else if (tag === "gender_everyone") out.add("Unisex Adult")
      }
      break
    case "pattern-emporium": {
      const type = fold(input.productType ?? "")
      if (/^womens\b/.test(type)) out.add("Women")
      if (/^girls\b/.test(type)) out.add("Girls")
      if (/^boys\b/.test(type)) out.add("Boys")
      if (/^baby\b/.test(type)) out.add("Baby")
      if (/^(?:kids|toddler)\b/.test(type)) out.add("Children")
      break
    }
    case "petite-stitchery": {
      // Approved signal: the store's kids-/adult-/baby- handle prefix.
      const prefix = fold(input.handle).split("-")[0]
      if (prefix === "kids") out.add("Children")
      else if (prefix === "baby") out.add("Baby")
      else if (prefix === "dolls") out.add("Doll")
      else if (prefix === "adult" || prefix === "adults") {
        if (has("unisex")) out.add("Unisex Adult")
        else if (has("men")) out.add("Men")
        else out.add("Women")
      }
      break
    }
    case "violette-field-threads":
      for (const tag of tags) {
        const prefix = tag.split("-")[0].trim()
        if (prefix === "girls" || prefix === "tween") out.add("Girls")
        else if (prefix === "misses") out.add("Women")
        else if (prefix === "baby") out.add("Baby")
        else if (prefix === "doll") out.add("Doll")
      }
      break
    case "winslets":
      if (has("mens")) out.add("Men")
      if (has("kids")) out.add("Children")
      break
    case "winter-wear-designs":
      if (has("women", "womens", "women's", "ladies", "adult")) out.add("Women")
      if (has("girl", "girls")) out.add("Girls")
      if (has("boy", "boys")) out.add("Boys")
      if (has("baby")) out.add("Baby")
      if (has("kid", "kids", "tween", "teen", "toddler")) out.add("Children")
      break
    case "ellie-and-mac":
      if (has("adult patterns", "womens")) out.add("Women")
      if (has("kids")) out.add("Children")
      if (has("baby")) out.add("Baby")
      if (has("boys")) out.add("Boys")
      if (has("doll")) out.add("Doll")
      break
    case "maison-fauve":
      break
  }
  return out
}

const WOMENSWEAR_DEFAULT = new Set<ShopifyStoreSlug>([
  "winslets",
  "maison-fauve",
  "pattern-emporium",
  "jalie",
  "winter-wear-designs",
])

// --- Fabric type (explicit tags only) ---------------------------------------

const KNIT_TAGS: Partial<Record<ShopifyStoreSlug, string[]>> = {
  jalie: ["fabric_knit fabric"],
  "petite-stitchery": ["knit", "knits", "swim knit"],
  "winter-wear-designs": ["knit", "knit'", "sweater knit", "sweater knits"],
  "pattern-emporium": ["knit", "knits", "knit skirt"],
  "ellie-and-mac": ["knit", "knit fabric", "knit pattern"],
}
const WOVEN_TAGS: Partial<Record<ShopifyStoreSlug, string[]>> = {
  jalie: ["fabric_woven fabric"],
  "petite-stitchery": ["woven", "wovens", "stretch wovens"],
  "winter-wear-designs": ["woven", "apparel woven"],
  "pattern-emporium": [
    "woven",
    "woven top",
    "woven dress",
    "woven pants",
    "woven pant",
    "woven t-shirt",
    "woven tee",
    "woven midi skirt",
  ],
  "ellie-and-mac": ["woven"],
}

function fabricTypes(store: ShopifyStoreSlug, input: ShopifyMetadataInput): string[] {
  const tags = lowerTags(input)
  const out: string[] = []
  const knit =
    (KNIT_TAGS[store] ?? []).some((t) => tags.has(t)) ||
    // Violette Field Threads: "girls- knit", "doll- knit", ...
    (store === "violette-field-threads" && [...tags].some((t) => /^[a-z]+-\s*knit$/.test(t)))
  if (knit) out.push("Knit")
  if ((WOVEN_TAGS[store] ?? []).some((t) => tags.has(t))) out.push("Woven")
  return out
}

// --- Difficulty (structured only) -------------------------------------------

const LEVEL_ORDER = ["Beginner", "Advanced Beginner", "Intermediate", "Advanced", "Expert"]

const LEVEL_WORDS: Record<string, string> = {
  debutant: "Beginner",
  beginner: "Beginner",
  "experienced beginner": "Advanced Beginner",
  "advanced beginner": "Advanced Beginner",
  intermediaire: "Intermediate",
  intermediate: "Intermediate",
  avance: "Advanced",
  advanced: "Advanced",
  expert: "Expert",
}

function difficulty(store: ShopifyStoreSlug, input: ShopifyMetadataInput): string | null {
  const levels: string[] = []
  if (store === "maison-fauve" || store === "jalie") {
    const prefix = store === "maison-fauve" ? /^(?:niveau|level)_(.+)$/ : /^complexity_(.+)$/
    for (const tag of lowerTags(input)) {
      const level = LEVEL_WORDS[tag.match(prefix)?.[1]?.trim() ?? ""]
      if (level) levels.push(level)
    }
  } else if (store === "pattern-emporium") {
    const text = fold((input.bodyHtml ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ")
    const word = text.match(
      /skill level\s*:?\s*(experienced beginner|advanced beginner|beginner|intermediate|advanced|expert)/,
    )?.[1]
    if (word && LEVEL_WORDS[word]) levels.push(LEVEL_WORDS[word])
  }
  if (levels.length === 0) return null
  // A pattern listed at several levels takes the easiest (Peek-A-Boo precedent).
  return levels.sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))[0]
}

// --- Entry point -------------------------------------------------------------

export function extractShopifyStoreMetadata(
  store: ShopifyStoreSlug,
  input: ShopifyMetadataInput,
): ExtractedMetadata {
  const meta = emptyMetadata()
  const rules = store === "maison-fauve" ? FAUVE_RULES : BASE_RULES

  const category =
    matchCategory(input.name, rules) ??
    structuredGarmentTexts(store, input)
      .map((text) => matchCategory(text, rules))
      .find((c): c is string => Boolean(c)) ??
    null
  if (category) meta.categories = [category]
  else if (input.name) meta.unmatched.push({ dimension: "category", term: input.name })

  let audiences = nameAudiences(input.name)
  if (audiences.size === 0) audiences = structuredAudiences(store, input)
  if (audiences.size === 0 && WOMENSWEAR_DEFAULT.has(store)) audiences.add("Women")
  meta.audiences = [...audiences]

  meta.fabricTypes = fabricTypes(store, input)
  meta.difficulty = difficulty(store, input)
  return meta
}
