import type { DesignerAdapter, ProductKind, ScrapedPattern } from "../types"
import { crawlSquarespaceStore } from "./squarespace-store"

// ---------------------------------------------------------------------------
// Homer + Howells
// ---------------------------------------------------------------------------
// A children's-wear indie label on SQUARESPACE. Fresh backfill.
//
// The store collection is /shop-online, returning 8 store products (recordType
// 11) via `/shop-online?format=json`, each with an image and a real publishOn
// date. Crawl/pagination/image/date mapping come from the shared
// squarespace-store helper.
//
// NAMES: titles are the design name plus a trailing " PDF" format tag
// ("Ingrid PDF", "Lennox PDF") or a "- FREE" tag ("Beginner Pocket Pack -
// FREE"). `cleanName` strips both so the stored name is just "Ingrid",
// "Beginner Pocket Pack". A free pattern is still a pattern.
// ---------------------------------------------------------------------------

const STORE = "https://www.homerandhowells.com"
const COLLECTION_PATH = "/shop-online"

const BUNDLE_TITLE = /\bbundles?\b/i
const NON_PATTERN_TITLE = /\bgift\s*cards?\b/i

export function cleanName(rawTitle: string): string {
  return rawTitle
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[-–]\s*free\s*$/i, "") // drop "- FREE" tag
    .replace(/\s+pdf\s*$/i, "") // drop trailing " PDF" format tag
    .trim()
}

function classify(name: string): ProductKind {
  if (NON_PATTERN_TITLE.test(name)) return "other"
  if (BUNDLE_TITLE.test(name)) return "bundle"
  return "pattern"
}

export const homerAndHowellsAdapter: DesignerAdapter = {
  slug: "homer-and-howells",
  label: "Homer + Howells",
  matchHosts: ["homerandhowells.com", "www.homerandhowells.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return crawlSquarespaceStore(STORE, COLLECTION_PATH, { cleanName, classify })
  },
}
