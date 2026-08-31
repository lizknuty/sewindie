import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Christine Haynes (christinehaynes.com) -- Squarespace.
//
// Store collection lives at /sewing-patterns (the generic /shop returns the CMS
// page as HTML). Titles carry a "- Digital Sewing Pattern" tail; bundles are
// named "... Collection Bundle". Small catalogue (~17).
// ---------------------------------------------------------------------------

const STORE = "https://christinehaynes.com"
const COLLECTION_PATH = "/sewing-patterns"

const BUNDLE = /\b(?:bundle|collection)\b/i
const GIFT = /gift\s*card/i

export function cleanChristineHaynesName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*[-–—]\s*digital sewing pattern\b.*$/i, " ")
    .replace(/\s*[-–—]\s*(?:digital )?sewing pattern\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  if (GIFT.test(name)) return "other"
  if (BUNDLE.test(name)) return "bundle"
  return "pattern"
}

export const christineHaynesAdapter: DesignerAdapter = {
  slug: "christine-haynes",
  label: "Christine Haynes",
  matchHosts: ["christinehaynes.com", "www.christinehaynes.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION_PATH, {
      cleanName: cleanChristineHaynesName,
      classify,
    })
  },
}
