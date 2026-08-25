// Shared contract for designer store adapters.
//
// Every designer sells through a different platform (WooCommerce, Shopify,
// bespoke carts), so each one needs its own bespoke fetching logic. This type
// is the seam that keeps that mess contained: the API routes and the admin UI
// only ever talk to `DesignerAdapter`, never to a specific store.

/** A single product pulled from a designer's live storefront. */
export type ScrapedPattern = {
  name: string
  url: string
  imageUrl: string | null
  /** ISO date string, or null when the store doesn't expose one. */
  releaseDate: string | null
  /** Multi-pattern bundles are flagged rather than filtered, so an admin can decide. */
  isBundle: boolean
  /** Upstream product id. Kept for stable React keys and debugging. */
  sourceId: string
}

export type DesignerAdapter = {
  /** Stable identifier for this adapter, e.g. "patterns-for-pirates". */
  slug: string
  label: string
  /**
   * Hostnames this adapter is responsible for. Used both to match a SewIndie
   * designer record to its adapter and to validate URLs before import, so a
   * buggy adapter can never write a pattern pointing at another domain.
   */
  matchHosts: string[]
  /** Fetches the designer's full public catalogue. */
  fetchCatalogue(): Promise<ScrapedPattern[]>
}
