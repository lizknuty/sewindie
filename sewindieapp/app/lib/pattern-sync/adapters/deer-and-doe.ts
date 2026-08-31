import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchClosetCoreVendor } from "./closetcore-store"

// ---------------------------------------------------------------------------
// Deer and Doe (deer-and-doe.com) -- Shopify.
// Now owned by Closet Core and sells from the SAME Shopify store; we keep only
// the "Deer & Doe" vendor products. See closetcore-store.ts.
// ---------------------------------------------------------------------------

export const deerAndDoeAdapter: DesignerAdapter = {
  slug: "deer-and-doe",
  label: "Deer and Doe",
  matchHosts: ["deer-and-doe.com", "www.deer-and-doe.com"],

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return fetchClosetCoreVendor(/deer/i)
  },
}
