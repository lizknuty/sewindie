// Structured metadata extracted from a designer's product listing, over and
// above the name/url/image/date that the sync itself needs.
//
// Every string in the dimension arrays is a *canonical SewIndie vocabulary
// name* (e.g. "Neckline (V-neck)"), never a raw store term. The adapter-specific
// extractor is responsible for translating the store's folksonomy into these
// names; the writer then resolves each name to a row id and links it additively.
// Anything the extractor could not confidently map is recorded in `unmatched`
// so a human can decide whether to extend the vocabulary or the mapping tables.

export type MetadataDimension =
  | "audience"
  | "category"
  | "fabricType"
  | "attribute"
  | "suggestedFabric"

/** A store term the extractor saw but chose not to map to any vocabulary row. */
export type UnmatchedTerm = {
  dimension: MetadataDimension
  /** The raw store term, as seen on the listing. */
  term: string
}

export type ExtractedMetadata = {
  audiences: string[]
  categories: string[]
  fabricTypes: string[]
  attributes: string[]
  suggestedFabrics: string[]
  /**
   * A single skill-level name (e.g. "Beginner"). Unlike the array dimensions,
   * difficulty is a scalar column on Pattern, so the writer applies it as an
   * additive scalar: set it only when the pattern has no difficulty yet, and
   * never overwrite an existing value.
   */
  difficulty: string | null
  /** Store terms that mapped to nothing -- candidates for new vocab/mappings. */
  unmatched: UnmatchedTerm[]
}

/** An empty result, used when a listing yields no usable metadata. */
export function emptyMetadata(): ExtractedMetadata {
  return {
    audiences: [],
    categories: [],
    fabricTypes: [],
    attributes: [],
    suggestedFabrics: [],
    difficulty: null,
    unmatched: [],
  }
}

/** True when there is at least one mapped value on any dimension. */
export function hasMetadata(m: ExtractedMetadata): boolean {
  return (
    m.audiences.length > 0 ||
    m.categories.length > 0 ||
    m.fabricTypes.length > 0 ||
    m.attributes.length > 0 ||
    m.suggestedFabrics.length > 0
  )
}
