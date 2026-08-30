import type { DesignerAdapter, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Les Perlines
// ---------------------------------------------------------------------------
// A French indie pattern brand on Squarespace. The catalogue is published TWICE
// as parallel bilingual collections that hold the SAME designs:
//   /patterns-20 -> English  ("The Mesa Top – pdf pattern",  /patterns-20/mesatop)
//   /patrons-20  -> French   ("Le Top Mesa - patron pdf",    /patrons-20/topmesa)
// Both are 18 items and one-to-one (Mesa Top == Top Mesa). We ingest ONLY the
// English `/patterns-20` collection -- pulling both would duplicate every
// pattern under two names. English is chosen to match the rest of the DB.
//
// Titles are "The <Name> <Garment> – pdf pattern" with an en-dash or hyphen and
// occasional missing space ("The Weekday Shirt– pdf pattern"). We strip the
// trailing " – pdf pattern" and the leading "The ". Identity is the product URL
// (shared helper), so cosmetic name drift never fragments a row. publishOn
// gives real staggered release dates and is kept.
// ---------------------------------------------------------------------------

const STORE = "https://www.lesperlines.com"
const COLLECTION = "/patterns-20"

// Strip a trailing format descriptor: " – pdf pattern", "- pdf pattern",
// "– pattern", even with a missing leading space ("Shirt– pdf pattern").
const FORMAT_TAIL = /\s*[–-]\s*(?:pdf\s+)?pattern\s*$/i

export function cleanLesPerlinesName(rawTitle: string): string {
  let name = (rawTitle ?? "").replace(/\s+/g, " ").trim()
  name = name.replace(FORMAT_TAIL, "")
  name = name.replace(/^the\s+/i, "")
  return name.trim()
}

export const lesPerlinesAdapter: DesignerAdapter = {
  slug: "les-perlines",
  label: "Les Perlines",
  matchHosts: ["lesperlines.com", "www.lesperlines.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION, {
      cleanName: cleanLesPerlinesName,
      classify: () => "pattern",
    })
  },
}
