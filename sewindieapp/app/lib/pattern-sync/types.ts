// Shared contract for designer store adapters.
//
// Every designer sells through a different platform (WooCommerce, Shopify,
// bespoke carts), so each one needs its own bespoke fetching logic. This type
// is the seam that keeps that mess contained: the API routes and the admin UI
// only ever talk to `DesignerAdapter`, never to a specific store.

/**
 * What kind of product a listing actually is. Anything other than "pattern" is
 * flagged in the UI rather than filtered out, so an admin decides case by case:
 *  - "bundle": several patterns sold together (P4P bundles, Jalie GALAXIE packs)
 *  - "addon":  an expansion that needs a base pattern bought separately
 */
export type ProductKind = "pattern" | "bundle" | "addon"

/** Human-readable chip text for a non-standalone product. */
export const KIND_LABELS: Record<Exclude<ProductKind, "pattern">, string> = {
  bundle: "Bundle",
  addon: "Add-on",
}

/** A single product pulled from a designer's live storefront. */
export type ScrapedPattern = {
  name: string
  url: string
  imageUrl: string | null
  /** ISO date string, or null when the store doesn't expose one. */
  releaseDate: string | null
  kind: ProductKind
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
