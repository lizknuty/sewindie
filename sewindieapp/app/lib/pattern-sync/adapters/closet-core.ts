import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchClosetCoreVendor } from "./closetcore-store"

// ---------------------------------------------------------------------------
// Closet Core Patterns (closetcorepatterns.com) -- Shopify.
// Shares one Shopify store with Deer & Doe; we keep only the Closet Core
// vendors ("Closet Core Patterns" + "Closet Core CREW"). See closetcore-store.ts.
// ---------------------------------------------------------------------------

export const closetCoreAdapter: DesignerAdapter = {
  slug: "closet-core",
  label: "Closet Core Patterns",
  matchHosts: ["closetcorepatterns.com", "www.closetcorepatterns.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return fetchClosetCoreVendor(/closet core/i)
  },
}
