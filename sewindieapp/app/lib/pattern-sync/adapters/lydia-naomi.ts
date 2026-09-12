import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Lydia Naomi (lydianaomi.com) -- Squarespace.
//
// Store collection lives at /shop-patterns (~28). The generic /shop returns the
// CMS page. Titles carry "PDF Sewing Pattern" or "| PDF Pattern" tails. Bundles
// are named "... Bundle". (There is a tiny /shop-drafts collection of draft
// patterns which we intentionally do NOT crawl -- those are works-in-progress.)
// ---------------------------------------------------------------------------

const STORE = "https://www.lydianaomi.com"
const COLLECTION_PATH = "/shop-patterns"

export function cleanLydiaNaomiName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/\s*\|\s*pdf\b.*$/i, " ")
    .replace(/\s*[-–—]?\s*pdf sewing pattern\b.*$/i, " ")
    .replace(/\s*[-–—]?\s*sewing pattern\b.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  if (/\b(?:bundle|collection)\b/i.test(name)) return "bundle"
  return "pattern"
}

export const lydiaNaomiAdapter: DesignerAdapter = {
  slug: "lydia-naomi",
  label: "Lydia Naomi",
  matchHosts: ["lydianaomi.com", "www.lydianaomi.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION_PATH, {
      cleanName: cleanLydiaNaomiName,
      classify,
    })
  },
}
