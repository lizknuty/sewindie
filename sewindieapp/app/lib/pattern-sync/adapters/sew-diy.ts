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

// "Eva Tops and Sundress PDF Sewing Pattern" -> "Eva Tops and Sundress".
export function cleanSewDiyName(title: string): string {
  return (title ?? "")
    .replace(/\s*\bpdf\s+(?:sewing\s+)?pattern\s*$/i, "")
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
      classify: () => "pattern",
    })
  },
}
