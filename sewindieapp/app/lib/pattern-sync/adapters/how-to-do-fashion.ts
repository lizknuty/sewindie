import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// How to Do Fashion (howtodofashion.com) -- Squarespace, /shop (~84 listings).
//
// Every design ships as a "<No. NN Name> - PDF Size 32-54" AND a matching
// "<No. NN Name> - Printed - Size 32-54" listing -- format twins of the same
// design. We collapse them by cleaned name, preferring the PDF listing. The
// design number ("No. 34 San Marino") is part of the identity and kept. Exclude
// the "HTDF Sewing Planner" (not a pattern). Bundles -> bundle.
// ---------------------------------------------------------------------------

const STORE = "https://www.howtodofashion.com"
const COLLECTION_PATH = "/shop"

export function cleanHowToDoFashionName(title: string): string {
  const cleaned = (title ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
    // Drop a "- PDF ..." or "- Printed ..." format+size tail.
    .replace(/\s*[-–—]\s*(pdf|printed)\b.*$/i, "")
    .replace(/\s*[-–—]\s*size\s+[\d\s-]+$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned || (title ?? "").replace(/\s+/g, " ").trim()
}

function classify(name: string): ProductKind {
  const n = name.toLowerCase()
  if (/sewing planner|gift card/.test(n)) return "other"
  if (/\bbundle\b/.test(n)) return "bundle"
  return "pattern"
}

export const howToDoFashionAdapter: DesignerAdapter = {
  slug: "how-to-do-fashion",
  label: "How to Do Fashion",
  matchHosts: ["howtodofashion.com", "www.howtodofashion.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    const raw = await crawlSquarespaceStore(STORE, COLLECTION_PATH, {
      cleanName: cleanHowToDoFashionName,
      classify,
    })
    // Collapse PDF/Printed format twins by cleaned name. The crawl yields items
    // in collection order (PDF listed alongside Printed); first-seen wins, and
    // since we cannot guarantee order, prefer a URL that looks like the PDF one.
    const byName = new Map<string, ScrapedPattern>()
    for (const p of raw) {
      const key = p.name.toLowerCase()
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, p)
        continue
      }
      // Keep whichever we already have unless the new one is clearly the PDF
      // and the existing one is the printed listing.
      if (/pdf/i.test(p.url) && /print/i.test(existing.url)) byName.set(key, p)
    }
    return [...byName.values()]
  },
}
