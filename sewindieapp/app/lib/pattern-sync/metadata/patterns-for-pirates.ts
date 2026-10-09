import { type ExtractedMetadata, emptyMetadata } from "./types"

// Patterns for Pirates metadata extraction.
//
// P4P moved from WooCommerce to Shopify (Oct 2026). The migration carried the
// old WooCommerce folksonomy over as plain Shopify tags ("Womens", "Dress",
// "Knit/Stretch Fabric", "Pockets"...) and added namespaced tags
// ("audience:girls", "garment:dresses", "fabric:knit", "type:bundle"...).
// Both are read here from the public products.json feed, together with
// `body_html` (the old short description) for the fabric-suggestion prose.
//
// The plain tags are a single flat folksonomy that mixes every SewIndie
// dimension together (audience, garment, fabric type, construction features).
// The mapping tables below translate them into exact SewIndie vocabulary
// names. Anything not in a table and not in the IGNORE set is surfaced as
// `unmatched` for review rather than silently dropped or guessed.

export type P4PProductSource = {
  tags: string[]
  /** Product description HTML (Shopify `body_html`). */
  description: string
}

// Namespaced tags added by the Shopify migration. Only the unambiguous ones map;
// coarse groupings (garment:bottoms, garment:one-pieces, audience:adult) are
// covered more precisely by the plain folksonomy tags. Unlisted namespaces
// (format:, fit:, shelf:, type:, migrated:) are commerce/file metadata.
const NAMESPACED_MAP: Record<string, { dimension: "audience" | "category" | "fabricType"; value: string }> = {
  "audience:women": { dimension: "audience", value: "Women" },
  "audience:girls": { dimension: "audience", value: "Girls" },
  "audience:boys": { dimension: "audience", value: "Boys" },
  "audience:kids": { dimension: "audience", value: "Children" },
  "garment:dresses": { dimension: "category", value: "Dress" },
  "garment:tops": { dimension: "category", value: "Tops" },
  "garment:jackets": { dimension: "category", value: "Coat / Jacket" },
  "garment:pajamas": { dimension: "category", value: "Sleepwear / Pajama" },
  "garment:swim": { dimension: "category", value: "Swimwear" },
  "fabric:knit": { dimension: "fabricType", value: "Knit" },
  "fabric:woven": { dimension: "fabricType", value: "Woven" },
}

/** Normalize a store term for table lookups: lowercase, collapse whitespace. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

// --- Fabric type -----------------------------------------------------------
const FABRIC_TYPE_MAP: Record<string, string> = {
  knit: "Knit",
  "knit/stretch fabric": "Knit",
  woven: "Woven",
  "woven/non-stretch fabric": "Woven",
}

// --- Audience --------------------------------------------------------------
const AUDIENCE_MAP: Record<string, string> = {
  womens: "Women",
  mens: "Men",
  girls: "Girls",
  boys: "Boys",
  baby: "Baby",
  youth: "Children",
  unisex: "Unisex Adult",
}

// --- Category (garment) ----------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  dresses: "Dress",
  dress: "Dress",
  "t-shirt dress": "Dress",
  jackets: "Coat / Jacket",
  jacket: "Coat / Jacket",
  cardigan: "Sweater / Sweatshirt",
  sweater: "Sweater / Sweatshirt",
  pajamas: "Sleepwear / Pajama",
  jammies: "Sleepwear / Pajama",
  tops: "Tops",
  top: "Tops",
  tank: "Tops",
  tunic: "Tops",
  "ringer tee": "Tops",
  bodysuit: "Bodysuit",
  romper: "Onesies / Rompers",
  onesie: "Onesies / Rompers",
  overalls: "Overalls / Coveralls",
  skirt: "Skirt",
  "mini skirt": "Skirt",
  skort: "Skort",
  shorts: "Short",
  pants: "Pants / Jeans",
  capri: "Pants / Jeans",
  leggings: "Leggings",
  swimsuit: "Swimwear",
  bikini: "Swimwear",
  "one piece": "Swimwear",
  bra: "Intimate Apparel",
  "sports bra": "Intimate Apparel",
  underwear: "Intimate Apparel",
  hat: "Beanie / Hat",
  beanie: "Beanie / Hat",
  headband: "Accessories",
  hoodie: "Hoodie",
  vest: "Vest",
  poncho: "Poncho",
}

// --- Attributes (construction / design features) ---------------------------
const ATTRIBUTE_MAP: Record<string, string> = {
  pockets: "Pockets",
  "crew neckline": "Neckline (Crew)",
  "v neckline": "Neckline (V-neck)",
  vneck: "Neckline (V-neck)",
  "scoop neckline": "Neckline (Scoop)",
  "boat neckline": "Neckline (Boat)",
  "square neckline": "Neckline (Square)",
  "sweetheart neckline": "Neckline (Sweetheart)",
  "cowl neckline": "Neckline (Cowl)",
  keyhole: "Neckline (Keyhole)",
  turtleneck: "Neckline (Turtleneck)",
  collar: "Collar",
  colorblocking: "Colorblocking",
  colorblock: "Colorblocking",
  peplum: "Peplum",
  "curved hem": "Hem (Curved)",
  "maxi/floor length": "Maxi Length",
  "maxi length": "Maxi Length",
  "midi length": "Midi Length",
  "mini length": "Mini Length",
  "empire waist": "Empire Waist",
  "dropped waist": "Dropped Waist",
  "gathered skirt": "Gathers",
  "gathered sleeves": "Gathers",
  flounce: "Flounce",
  godet: "Godet",
  "circle skirt": "Circle Skirt",
  "shelf bra": "Shelf Bra",
  "full bust adjustment pieces": "Full Bust Adjustment (FBA)",
  "small bust adjustment pieces": "Full Bust Adjustment (FBA)",
  reversible: "Reversible",
  ruching: "Ruching",
  shirring: "Shirring",
  boning: "Boning",
  "fully lined": "Lining (Full)",
  lined: "Lining (Full)",
  "bubble skirt": "Bubble Skirt",
  pleats: "Pleats",
  // Sleeves -- P4P uses short folksonomy labels; DB uses "Sleeves (X)".
  // NB: there is no generic "Sleeves (Long)" in the vocab, so "long sleeve" is
  // deliberately left unmapped (reported) rather than forced onto a wrong row.
  "short sleeve": "Sleeves (Short)",
  "3/4 sleeve": "Sleeves (3/4)",
  "cap sleeve": "Sleeves (Cap)",
  "bishop sleeve": "Sleeves (Bishop)",
  "flutter sleeves": "Sleeves (Flutter)",
  "raglan sleeve": "Sleeves (Raglan)",
  "dolman/dropped shoulder": "Sleeves (Dolman)",
  "bell sleeve": "Sleeves (Bell)",
  "puff sleeve": "Sleeves (Puffed)",
  "balloon sleeve": "Sleeves (Balloon)",
  "cold shoulder": "Sleeves (Cold Shoulder)",
  sleeveless: "Sleeveless",
  // Waist / closures
  "elastic waist": "Waistband (Elastic)",
  "yoga waistband": "Waistband (Yoga)",
  drawstring: "Waistband (Drawstring)",
  zipper: "Zipper",
  "cargo pockets": "Pockets",
  "crop length": "Crop Top",
  ties: "Ties",
  "wrap front": "Wrap Front",
  "fit and flare": "Fit-and-Flare",
  // "Hood" has no vocabulary row yet; kept mapped so it surfaces as a clear
  // vocab candidate in the writer's "missing" report (39 patterns want it).
  hood: "Hood",
}

// Store terms that are deliberately NOT metadata: file formats, commerce/
// marketing labels, body-shape and size groupings, and terms already consumed
// by the fabric-type or audience maps. These are dropped silently so the
// `unmatched` report stays focused on genuine vocabulary candidates.
const IGNORE = new Set<string>(
  [
    // file formats / deliverables
    "a0 copy shop file", "projector file", "metric charts", "cutfiles", "video",
    "layers",
    // commerce / marketing
    "patterns", "bundle", "bundles", "family bundle", "free", "freebies",
    "holiday", "holiday freebies 2023", "flash friday", "gift cards", "sporty",
    "loungewear",
    // body shape / size groupings (not audience)
    "adult", "hourglass figure", "hourglass figure-adult", "v figure",
    "v figure-adult", "v figure-youth", "youth-hourglass figure",
    "youth-v figure", "tall", "fitted", "semi-fitted", "high rise", "mid rise",
    // ambiguous P4P navigation groupings (rely on specific tags instead)
    "bottoms", "tops and dresses", "swim & undergarments", "pants/shorts",
  ].map(norm),
)

// --- Suggested fabrics ------------------------------------------------------
// Parsed from free text, so we need a synonym layer on top of exact matches
// against the SuggestedFabric vocabulary. Keys are normalized fabric phrases.
const SUGGESTED_FABRIC_SYNONYMS: Record<string, string> = {
  "linen blends": "Linen Blend",
  "linen blend": "Linen Blend",
  linen: "Linen",
  cottons: "Cotton",
  cotton: "Cotton",
  "quilting cottons": "Cotton",
  "quilting cotton": "Cotton",
  "french terry": "French Terry",
  "french cotton terry": "French Cotton Terry",
  "sweatshirt fleece": "Sweatshirt Fleece",
  "rayon challis": "Rayon Challis",
  "cotton spandex": "Cotton Spandex",
  "athletic knit": "Athletic Knit",
  "rib knit": "Rib Knit",
  "yummy rib knit": "Rib Knit",
  ribbing: "Rib Knit",
  "sweater knit": "Sweater Knit",
  "sweater knits": "Sweater Knit",
  chambray: "Chambray",
  chambrays: "Chambray",
  poplin: "Poplin",
  "thinner poplin": "Poplin",
  seersucker: "Seersucker",
  ponte: "Ponte",
  "double gauze": "Double Gauze",
  gauze: "Gauze",
  flannel: "Flannel",
  jersey: "Jersey Knit",
  "jersey knit": "Jersey Knit",
  "cotton jersey": "Jersey Knit",
  interlock: "Interlock Knit",
  "interlock knit": "Interlock Knit",
  scuba: "Scuba",
  ity: "ITY Knit",
  "ity knit": "ITY Knit",
  liverpool: "Liverpool",
  modal: "Modal",
  fleece: "Fleece",
  "swim knit": "Swim Knit",
  "power mesh": "Power Mesh",
  twill: "Twill",
  corduroy: "Corduroy",
  velvet: "Velvet",
  velour: "Velour",
  satin: "Satin",
  denim: "Stretch Denim",
  "stretch denim": "Stretch Denim",
  "rayon spandex": "Rayon Spandex",
  "bamboo jersey": "Bamboo Jersey",
  "bamboo lycra": "Bamboo Lycra",
  rayon: "Rayon",
  "sweatshirt knit": "Sweatshirt Fleece",
  "ribbed knits": "Rib Knit",
  "brushed ribbed knits": "Rib Knit",
  "double knits": "Double Knit",
  "double knit": "Double Knit",
  "micro fleece": "Fleece",
  mircofleece: "Fleece",
  "fleece back athletic knit": "Athletic Knit",
  "fleece-backed knits": "Fleece",
  "double brushed polyester": "Double Brushed Poly",
  "double brushed poly": "Double Brushed Poly",
  "dbp (double brushed polyester knit)": "Double Brushed Poly",
  dbp: "Double Brushed Poly",
  "modal knit blends": "Modal Jersey",
  "modal knit": "Modal Jersey",
  waffle: "Waffle Knit",
  "waffle knits": "Waffle Knit",
  "waffle knit": "Waffle Knit",
  "brushed waffle knits": "Waffle Knit",
  "rayon twill": "Tencel Twill",
  "tencil twill": "Tencel Twill",
  "boardshort fabric": "Performance Fabric",
  jean: "Stretch Denim",
  madras: "Cotton",
  "spandex french terry blends": "French Terry",
  velvets: "Velvet",
  knits: "Jersey Knit",
  "swim knits": "Swim Knit",
  dty: "Performance Fabric",
  minky: "Fleece",
  sherpa: "Fleece",
  "quilted knits": "Quilted Jersey",
  "cuddle fabrics": "Fleece",
  suiting: "Wool Suiting",
  shirting: "Broadcloth",
  "nylon spandex": "Nylon",
  "rayon challis blends": "Rayon Challis",
}

// Filler words that surround real fabric names in prose; stripped before match.
const FABRIC_STOPWORDS = new Set(
  [
    "other", "others", "similar", "etc", "and", "or", "even", "some", "those",
    "medium-weight", "medium", "weight", "light", "lightweight", "heavy",
    "heavyweight", "stable", "high-stretch", "high", "stretch", "good",
    "recovery", "with", "a", "the", "soft", "yummy", "thinner", "yes", "so",
    "easy", "to", "find", "that", "are",
  ],
)

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&#8216;|&#39;/g, "'")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/&#8243;|&#34;|&quot;/g, '"')
    .replace(/&#160;|&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Pull candidate fabric phrases out of the short description. P4P uses two
 * shapes, sometimes both: an explicit "Fabric Suggestions: a, b, c" line, and a
 * "designed/drafted for ... works/sews beautifully in a, b, and c" sentence.
 */
function extractFabricPhrases(shortDescription: string): string[] {
  const text = stripHtml(shortDescription)
  const phrases: string[] = []

  const explicit = text.match(
    /(?:specific\s+)?fabric suggestions?:\s*([^.]*?)(?:\.|$|adult sizes|youth sizes|sizes included|note:)/i,
  )
  if (explicit?.[1]) phrases.push(explicit[1])

  const prose = text.match(
    /(?:works|sews)(?:\s+up)?\s+(?:beautifully|great|well)\s+(?:in|with)\s+([^.]*?)(?:\.|$)/i,
  )
  if (prose?.[1]) phrases.push(prose[1])

  return phrases
}

function matchFabrics(phrases: string[]): { matched: string[]; unmatched: string[] } {
  const matched = new Set<string>()
  const unmatched = new Set<string>()

  for (const phrase of phrases) {
    // Split a suggestion list into individual fabric candidates.
    const parts = phrase
      .split(/,|\band\b|\bor\b|\/|;|&/i)
      .map((p) => norm(p))
      .map((p) =>
        p
          .split(" ")
          .filter((w) => w && !FABRIC_STOPWORDS.has(w))
          .join(" ")
          .trim(),
      )
      .filter(Boolean)

    for (const candidate of parts) {
      // The synonym map keys are the real fabric phrases P4P uses and its
      // values are exact SuggestedFabric vocabulary names, so a hit is a
      // confident match. The writer still resolves the name against the live
      // vocabulary and reports it if the row is ever missing.
      const syn = SUGGESTED_FABRIC_SYNONYMS[candidate]
      if (syn) {
        matched.add(syn)
        continue
      }
      // Ignore obviously non-fabric fragments left over from prose.
      if (candidate.length < 3 || /\d/.test(candidate)) continue
      unmatched.add(candidate)
    }
  }

  return { matched: [...matched], unmatched: [...unmatched] }
}

/**
 * Translate a P4P Shopify product into canonical SewIndie vocabulary names.
 * Requires no DB access: audience/category/fabric-type/attribute use static
 * mapping tables, and fabrics use the synonym map. The writer resolves the
 * produced names against the live vocabulary and reports any that are missing.
 */
export function extractP4PMetadata(product: P4PProductSource): ExtractedMetadata {
  const meta = emptyMetadata()
  const audiences = new Set<string>()
  const categories = new Set<string>()
  const fabricTypes = new Set<string>()
  const attributes = new Set<string>()
  const unmatched: ExtractedMetadata["unmatched"] = []

  for (const raw of product.tags ?? []) {
    const key = norm(raw)
    if (!key || IGNORE.has(key)) continue

    if (key.includes(":")) {
      const hit = NAMESPACED_MAP[key]
      if (hit?.dimension === "audience") audiences.add(hit.value)
      if (hit?.dimension === "category") categories.add(hit.value)
      if (hit?.dimension === "fabricType") fabricTypes.add(hit.value)
      continue
    }

    let mapped = false
    if (FABRIC_TYPE_MAP[key]) {
      fabricTypes.add(FABRIC_TYPE_MAP[key])
      mapped = true
    }
    if (AUDIENCE_MAP[key]) {
      audiences.add(AUDIENCE_MAP[key])
      mapped = true
    }
    if (CATEGORY_MAP[key]) {
      categories.add(CATEGORY_MAP[key])
      mapped = true
    }
    if (ATTRIBUTE_MAP[key]) {
      attributes.add(ATTRIBUTE_MAP[key])
      mapped = true
    }
    if (!mapped) unmatched.push({ dimension: "attribute", term: raw })
  }

  // Fabric type also lives in the "designed/drafted for ... knit/woven" prose,
  // which catches products that lack a Knit/Woven category tag.
  const descText = stripHtml(product.description).toLowerCase()
  const designedFor = descText.match(/(?:designed|drafted) for[^.]*/)?.[0] ?? ""
  if (/\bknit/.test(designedFor)) fabricTypes.add("Knit")
  if (/\bwoven/.test(designedFor)) fabricTypes.add("Woven")

  const fabrics = matchFabrics(extractFabricPhrases(product.description))
  for (const f of fabrics.unmatched) unmatched.push({ dimension: "suggestedFabric", term: f })

  meta.audiences = [...audiences]
  meta.categories = [...categories]
  meta.fabricTypes = [...fabricTypes]
  meta.attributes = [...attributes]
  meta.suggestedFabrics = fabrics.matched
  meta.unmatched = unmatched
  return meta
}
