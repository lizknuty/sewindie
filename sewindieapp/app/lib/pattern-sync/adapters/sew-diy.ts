import type { DesignerAdapter, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Sew DIY (sewdiy.com) -- Squarespace store at the /shop collection.
//
// The store products live under /shop (recordType 11); the shared crawler
// handles fetch + offset pagination. Every product is a PDF sewing pattern, so
// there is nothing to exclude. Titles carry a "PDF (Sewing) Pattern" tail that
// we strip. Some products are add-on/expansion packs (e.g. "Lou Box Sleeve
// Expansion") -- these are genuine standalone patterns, so they are kept.
// Release date from publishOn.
// ---------------------------------------------------------------------------

const STORE = "https://www.sewdiy.com"
const COLLECTION = "/shop"

const BUNDLE = /\bbundle\b/i

// Strip the format descriptor tail, which varies across singles and bundles:
//   "Eva Tops and Sundress PDF Sewing Pattern"        -> "Eva Tops and Sundress"
//   "... Digital Sewing Patterns"                     -> "..."
//   "Work-From-Home Capsule Wardrobe PDF Pattern Bundle" -> "... Bundle"
// Keep a trailing "Bundle" (real product distinction) but drop the redundant
// (PDF|Digital) (Sewing) Pattern(s) words wherever they sit near the end.
export function cleanSewDiyName(title: string): string {
  return (title ?? "")
    .replace(/\s*\b(?:pdf|digital)\s+(?:sewing\s+)?patterns?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const sewDiyAdapter: DesignerAdapter = {
  slug: "sew-diy",
  label: "Sew DIY",
  matchHosts: ["sewdiy.com", "www.sewdiy.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION, {
      cleanName: (rawTitle) => cleanSewDiyName(rawTitle),
      classify: (rawTitle) => (BUNDLE.test(rawTitle) ? "bundle" : "pattern"),
    })
  },
}
