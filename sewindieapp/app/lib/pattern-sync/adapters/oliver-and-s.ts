import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchOliverandsBrandCatalogue, oliverandsSlug } from "./oliverands-store"

// ---------------------------------------------------------------------------
// Oliver + S
// ---------------------------------------------------------------------------
// Oliver + S is the flagship brand of the shared oliverands.com Miva store (its
// SewIndie designer's URL IS oliverands.com), sharing the storefront with its
// sibling brands Liesl + Co and Lisette. Like the Liesl adapter, this one
// delegates the crawl to the shared `oliverands-store` module and filters the
// catalogue to the "Oliver + S" GA4 brand.
//
//   - Unlike Liesl, the designer's own host (oliverands.com) IS where its
//     patterns live, so `matchHosts` covers both designer resolution and import
//     validation -- no `importHosts` override is needed.
//   - Reconciliation is by URL SLUG (`identityKey`): Oliver + S sells designs in
//     both paper and DIGITAL ("digital-...") form and the existing rows store
//     each separately, so these are NOT collapsed.
//   - The brand match is anchored to exactly "Oliver + S" so it can never catch
//     a sibling brand.
//
// Verified: 78 products resolve to "Oliver + S", matching 78 of the 79 existing
// rows. The 79th ("Metro + School Bus T-shirt Family Pack") is attributed to
// "Liesl + Co." on the store, so it is intentionally out of this brand's crawl
// (harmless: comparePatterns never deletes existing rows).
// ---------------------------------------------------------------------------

const OLIVER_BRAND = /^oliver\s*\+\s*s$/i

export const oliverAndSAdapter: DesignerAdapter = {
  slug: "oliver-and-s",
  label: "Oliver + S",
  matchHosts: ["oliverands.com", "www.oliverands.com"],

  identityKey(url) {
    return oliverandsSlug(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return fetchOliverandsBrandCatalogue(OLIVER_BRAND, "Oliver + S")
  },
}
