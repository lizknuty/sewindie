import type { DesignerAdapter, ScrapedPattern } from "../types"
import { fetchOliverandsBrandCatalogue, oliverandsSlug } from "./oliverands-store"

// ---------------------------------------------------------------------------
// Liesl + Co
// ---------------------------------------------------------------------------
// Liesl + Co does not sell from its own site: lieslandco.com (the designer's
// stored URL) is now just a Mailchimp marketing page with no catalogue. Every
// Liesl + Co pattern is sold on the shared oliverands.com Miva store, so this
// adapter delegates the crawl to the shared `oliverands-store` module and
// filters that store's catalogue to the "Liesl + Co." GA4 brand.
//
//   - `matchHosts` lists lieslandco.com so the designer record (whose URL is
//     lieslandco.com) resolves to this adapter. oliverands.com is deliberately
//     kept OUT of `matchHosts`: the separate "Oliver and S" SewIndie designer
//     owns that host, and listing it here would hijack that designer's
//     resolution.
//   - `importHosts` lists oliverands.com so the scraped URLs pass import
//     validation.
//   - Reconciliation is by URL SLUG (`identityKey`): Liesl sells most designs
//     in both paper and DIGITAL ("digital-...") form and the existing rows store
//     each separately, so these are NOT collapsed -- each store product is one
//     pattern.
//
// Verified: 96 products resolve to "Liesl + Co." (95 existing rows + expected
// drift), including one "Liesl + Co."-attributed family pack.
// ---------------------------------------------------------------------------

const LIESL_BRAND = /liesl\s*\+\s*co/i

export const lieslAndCoAdapter: DesignerAdapter = {
  slug: "liesl-and-co",
  label: "Liesl + Co",
  matchHosts: ["lieslandco.com", "www.lieslandco.com"],
  importHosts: ["oliverands.com", "www.oliverands.com"],

  identityKey(url) {
    return oliverandsSlug(url)
  },

  async fetchCatalogue(): Promise<ScrapedPattern[]> {
    return fetchOliverandsBrandCatalogue(LIESL_BRAND, "Liesl + Co")
  },
}
