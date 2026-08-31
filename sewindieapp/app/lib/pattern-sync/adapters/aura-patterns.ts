import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Aura Patterns (aurasewingpatterns.com)
// ---------------------------------------------------------------------------
// SQUARESPACE store. The full catalogue (43 store products, recordType 11) is
// served by the /shop collection via `/shop?format=json` -- all with images and
// publishOn dates. Crawl + pagination + image/date mapping come from the shared
// squarespace-store helper.
//
// NAMES ARE HEAVILY SEO-STUFFED with pipe-delimited keyword tails, e.g.
//   "Easy Cardigan Sewing Pattern | XS-XXXL | Digital PDF | Women's Drop
//    Shoulder Jumper Sweater"
//   "Knot Bag Sewing Pattern | One Size | Easy Digital PDF | Japanese Knot Bag"
// cleanName keeps only the segment before the first pipe and strips the trailing
// "Sewing Pattern" descriptor, so the two above become "Easy Cardigan" and
// "Knot Bag". Identity is the Squarespace slug, so cleaning is display-only.
// ---------------------------------------------------------------------------

const STORE = "https://www.aurasewingpatterns.com"
const COLLECTION_PATH = "/shop"

const BUNDLE_TITLE = /\b(?:bundle|pack|collection)\b/i
const NON_PATTERN_TITLE = /\bgift\s*cards?\b/i

export function cleanAuraName(rawTitle: string): string {
  let name = rawTitle.replace(/\s+/g, " ").trim()
  // Keep only the segment before the first pipe (drops "| XS-XXXL | Digital PDF | ...").
  const pipeIdx = name.indexOf("|")
  if (pipeIdx !== -1) name = name.slice(0, pipeIdx).trim()
  // Strip the trailing "(Easy) (Digital) Sewing Pattern" descriptor.
  name = name
    .replace(/\s*\b(?:easy\s+)?(?:digital\s+)?(?:sewing\s+)?patterns?\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return name || rawTitle.replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  if (NON_PATTERN_TITLE.test(name)) return "other"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

export const auraPatternsAdapter: DesignerAdapter = {
  slug: "aura-patterns",
  label: "Aura Patterns",
  matchHosts: ["aurasewingpatterns.com", "www.aurasewingpatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION_PATH, { cleanName: cleanAuraName, classify })
  },
}
