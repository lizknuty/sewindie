import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Made My Wardrobe
// ---------------------------------------------------------------------------
// A UK sewing studio on Squarespace. The site is a large mixed shop split into
// many collections -- /workshop, /sewing-machines, /fabric, /online-courses,
// /*-kits, /haberdashery-1, etc. -- so crawling the whole store would pull in
// workshops, Pfaff machines, fabric and kits. The actual sewing patterns live
// in the single `/patterns` collection, which is the only one we ingest.
//
// FORMAT COLLAPSE: every design is sold as a "- Printed Version" AND a
// "- PDF Version" listing (a few say "- Printed Pattern"):
//   "Delilah Dress - Printed Pattern"  +  "Delilah Dress - PDF Version"
//   "Hilda Bag - Printed Version"      +  "Hilda Bag - PDF Version"
// These are one design in two formats, collapsed on a key that strips the
// trailing " - <PDF|Printed> <Version|Pattern>". 30 listings -> 15 designs.
// The PDF listing wins as canonical. "Home Collection Pattern Bundle" -> bundle.
//
// The shared Squarespace crawler dedups by URL, but PDF/Printed are DIFFERENT
// URLs, so the format collapse is done here after crawling. publishOn gives
// real release dates and is kept.
// ---------------------------------------------------------------------------

const STORE = "https://mademywardrobe.com"
const COLLECTION = "/patterns"

// Trailing " - PDF Version" / " - Printed Version" / " - Printed Pattern".
const FORMAT_TAIL = /\s*[-–]\s*(?:pdf|printed|paper)\s+(?:version|pattern)\s*$/i

export function cleanMadeMyWardrobeName(rawTitle: string): string {
  const name = (rawTitle ?? "").replace(/\s+/g, " ").trim().replace(FORMAT_TAIL, "").trim()
  return name || (rawTitle ?? "").trim()
}

function classify(name: string): ProductKind {
  if (/\bbundles?\b/i.test(name)) return "bundle"
  if (/\b(kit|kits|voucher|gift card|club|subscription)\b/i.test(name)) return "other"
  return "pattern"
}

export const madeMyWardrobeAdapter: DesignerAdapter = {
  slug: "made-my-wardrobe",
  label: "Made My Wardrobe",
  matchHosts: ["mademywardrobe.com", "www.mademywardrobe.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    // The crawler cleans the name (stripping the format tail); the PDF and
    // Printed listings therefore share a name but keep distinct URLs.
    const raw = await crawlSquarespaceStore(STORE, COLLECTION, {
      cleanName: cleanMadeMyWardrobeName,
      classify,
    })

    // Collapse PDF/Printed pairs by cleaned name, preferring the PDF listing
    // (its URL contains "pdf"). First seen otherwise.
    const byName = new Map<string, ScrapedPattern>()
    for (const pattern of raw) {
      const key = pattern.name.toLowerCase()
      const existing = byName.get(key)
      const isPdf = /pdf/i.test(pattern.url)
      if (!existing) {
        byName.set(key, pattern)
      } else if (isPdf && !/pdf/i.test(existing.url)) {
        byName.set(key, pattern) // upgrade to the PDF listing
      }
    }
    return [...byName.values()]
  },
}
