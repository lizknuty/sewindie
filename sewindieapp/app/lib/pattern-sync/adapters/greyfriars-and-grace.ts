import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Greyfriars and Grace
// ---------------------------------------------------------------------------
// A Scottish upcycling-focused indie label on SQUARESPACE. Fresh backfill.
//
// The obvious store collection (/shop-clothing) is a "Coming Soon" placeholder;
// the real catalogue lives in the /patterns collection, which returns 20 store
// products (recordType 11) via `/patterns?format=json` -- all with images and
// real publishOn dates. Crawl + pagination + image/date mapping are handled by
// the shared squarespace-store helper.
//
// NAMES NEED CLEANING. Greyfriars writes extremely long, SEO-stuffed titles
// that bake the whole marketing pitch into the product name, e.g.
//   "Easy Nova Scotia Skirt Sewing Pattern (Adult) - with optional pockets but
//    no zip or buttons! Full tutorial with step by step photos"
//   "Cairngorm Collar Top Sewing Pattern (Shirt Upcycle with YouTube video)"
// `cleanName` reduces these to the actual garment name in four steps:
//   1. cut everything after the first " - " (the descriptive sentence tail),
//   2. drop trailing marketing phrases ("& YouTube video", "includes video
//      tutorial", "& Tutorial", ...),
//   3. remove a MARKETING parenthetical ("(Shirt Upcycle...)") but KEEP a
//      size/age qualifier ("(Adult)", "(Age 2-9)") -- these distinguish
//      genuinely separate adult vs. kids products and must not be dropped, or
//      "Stornoway Cape (Adult)" and "Stornoway Cape (Ages 2-9)" would collapse
//      to the same display name,
//   4. strip a trailing "Sewing Pattern" / "Pattern".
// Identity is the Squarespace slug, so even a name collision would never merge
// rows -- cleaning is purely for display quality.
// ---------------------------------------------------------------------------

const STORE = "https://www.greyfriarsandgrace.com"
const COLLECTION_PATH = "/patterns"

const BUNDLE_TITLE = /\bbundles?\b/i
const NON_PATTERN_TITLE = /\bgift\s*cards?\b/i

// Trailing video/tutorial marketing phrases (no size info) to drop.
const TRAILING_MARKETING = /\s*(?:&\s*)?(?:includes?\s+)?(?:youtube\s+)?(?:video\s*)?(?:tutorial)?(?:\s*&\s*youtube\s+video)?\s*$/i

// A parenthetical is a size/age qualifier worth KEEPING if it mentions a
// number, "adult", "age(s)", "kid(s)", "baby", "child", "years".
const SIZE_QUALIFIER = /\d|\b(?:adult|ages?|kids?|baby|child(?:ren)?|years?)\b/i

export function cleanName(rawTitle: string): string {
  let name = rawTitle.replace(/\s+/g, " ").trim()

  // 1. Cut the descriptive sentence tail after the first " - " / " – ".
  const dashIdx = name.search(/\s[-–]\s/)
  if (dashIdx !== -1) name = name.slice(0, dashIdx).trim()

  // 3. Remove marketing parentheticals, keep size/age qualifiers.
  name = name
    .replace(/\s*\(([^)]*)\)/g, (whole, inner: string) => (SIZE_QUALIFIER.test(inner) ? whole : ""))
    .trim()

  // 2. Drop trailing "& YouTube video" / "includes video tutorial" phrases.
  const beforeMarketing = name
  name = name.replace(TRAILING_MARKETING, "").trim()
  if (!name) name = beforeMarketing // never blank out the whole name

  // 4. Strip "Sewing Pattern" / "Pattern" when it is the trailing descriptor,
  //    whether at the very end OR immediately before a kept size/age
  //    parenthetical ("Stornoway Cape Sewing Pattern (Ages 2-9)" ->
  //    "Stornoway Cape (Ages 2-9)").
  name = name.replace(/\s+(?:sewing\s+)?pattern\b(?=\s*(?:\(|$))/i, "").trim()

  return name.replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  if (NON_PATTERN_TITLE.test(name)) return "other"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

export const greyfriarsAndGraceAdapter: DesignerAdapter = {
  slug: "greyfriars-and-grace",
  label: "Greyfriars and Grace",
  matchHosts: ["greyfriarsandgrace.com", "www.greyfriarsandgrace.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION_PATH, { cleanName, classify })
  },
}
