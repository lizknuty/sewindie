import type { PrismaClient } from "@prisma/client"
import type { ExtractedMetadata, MetadataDimension } from "./types"

// Shared, additive metadata writer used by both the one-time backfill script
// and the live import route. It resolves canonical vocabulary names to row ids
// and links them to a pattern, and it NEVER removes an existing link -- the
// policy is "add missing, never remove". A mapped name that has no matching
// vocabulary row is reported as `vocabMissing` rather than created, so the
// controlled vocabularies only ever grow by human decision.

export type Vocab = {
  audience: Map<string, number>
  category: Map<string, number>
  fabricType: Map<string, number>
  attribute: Map<string, number>
  suggestedFabric: Map<string, number>
}

const keyOf = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim()

/** Load every controlled vocabulary once, keyed by normalized name. */
export async function loadVocab(prisma: PrismaClient): Promise<Vocab> {
  const [audiences, categories, fabricTypes, attributes, suggestedFabrics] = await Promise.all([
    prisma.audience.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.fabricType.findMany({ select: { id: true, name: true } }),
    prisma.attribute.findMany({ select: { id: true, name: true } }),
    prisma.suggestedFabric.findMany({ select: { id: true, name: true } }),
  ])

  const toMap = (rows: Array<{ id: number; name: string }>) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(keyOf(r.name), r.id)
    return m
  }

  return {
    audience: toMap(audiences),
    category: toMap(categories),
    fabricType: toMap(fabricTypes),
    attribute: toMap(attributes),
    suggestedFabric: toMap(suggestedFabrics),
  }
}

/** Names that were produced by the extractor but are absent from the DB vocab. */
export type VocabMiss = { dimension: MetadataDimension; name: string }

export type ApplyPlan = {
  patternId: number
  /** Links that would be (or were) newly created, per dimension. */
  toAdd: Record<MetadataDimension, string[]>
  /** Mapped names with no vocabulary row -- neither linked nor created. */
  vocabMissing: VocabMiss[]
}

type DimensionConfig = {
  dimension: MetadataDimension
  names: string[]
  vocab: Map<string, number>
}

function planForDimension(
  existingIds: Set<number>,
  cfg: DimensionConfig,
): { add: Array<{ id: number; name: string }>; missing: VocabMiss[] } {
  const add: Array<{ id: number; name: string }> = []
  const missing: VocabMiss[] = []
  const seen = new Set<number>()

  for (const name of cfg.names) {
    const id = cfg.vocab.get(keyOf(name))
    if (id === undefined) {
      missing.push({ dimension: cfg.dimension, name })
      continue
    }
    if (existingIds.has(id) || seen.has(id)) continue
    seen.add(id)
    add.push({ id, name })
  }

  return { add, missing }
}

/**
 * Compute (and optionally commit) the additive links for one pattern.
 * When `execute` is false, nothing is written -- the returned plan is a dry run.
 */
export async function applyMetadata(
  prisma: PrismaClient,
  patternId: number,
  meta: ExtractedMetadata,
  vocab: Vocab,
  execute: boolean,
): Promise<ApplyPlan> {
  const [pa, pau, pc, pft, psf] = await Promise.all([
    prisma.patternAttribute.findMany({ where: { pattern_id: patternId }, select: { attribute_id: true } }),
    prisma.patternAudience.findMany({ where: { pattern_id: patternId }, select: { audience_id: true } }),
    prisma.patternCategory.findMany({ where: { pattern_id: patternId }, select: { category_id: true } }),
    prisma.patternFabricType.findMany({ where: { pattern_id: patternId }, select: { fabrictype_id: true } }),
    prisma.patternSuggestedFabric.findMany({
      where: { pattern_id: patternId },
      select: { suggestedfabric_id: true },
    }),
  ])

  const existing = {
    attribute: new Set(pa.map((r) => r.attribute_id)),
    audience: new Set(pau.map((r) => r.audience_id)),
    category: new Set(pc.map((r) => r.category_id)),
    fabricType: new Set(pft.map((r) => r.fabrictype_id)),
    suggestedFabric: new Set(psf.map((r) => r.suggestedfabric_id)),
  }

  const audience = planForDimension(existing.audience, { dimension: "audience", names: meta.audiences, vocab: vocab.audience })
  const category = planForDimension(existing.category, { dimension: "category", names: meta.categories, vocab: vocab.category })
  const fabricType = planForDimension(existing.fabricType, { dimension: "fabricType", names: meta.fabricTypes, vocab: vocab.fabricType })
  const attribute = planForDimension(existing.attribute, { dimension: "attribute", names: meta.attributes, vocab: vocab.attribute })
  const suggestedFabric = planForDimension(existing.suggestedFabric, {
    dimension: "suggestedFabric",
    names: meta.suggestedFabrics,
    vocab: vocab.suggestedFabric,
  })

  const plan: ApplyPlan = {
    patternId,
    toAdd: {
      audience: audience.add.map((a) => a.name),
      category: category.add.map((a) => a.name),
      fabricType: fabricType.add.map((a) => a.name),
      attribute: attribute.add.map((a) => a.name),
      suggestedFabric: suggestedFabric.add.map((a) => a.name),
    },
    vocabMissing: [
      ...audience.missing,
      ...category.missing,
      ...fabricType.missing,
      ...attribute.missing,
      ...suggestedFabric.missing,
    ],
  }

  if (!execute) return plan

  await prisma.$transaction([
    ...(audience.add.length
      ? [prisma.patternAudience.createMany({
          data: audience.add.map((a) => ({ pattern_id: patternId, audience_id: a.id })),
          skipDuplicates: true,
        })]
      : []),
    ...(category.add.length
      ? [prisma.patternCategory.createMany({
          data: category.add.map((a) => ({ pattern_id: patternId, category_id: a.id })),
          skipDuplicates: true,
        })]
      : []),
    ...(fabricType.add.length
      ? [prisma.patternFabricType.createMany({
          data: fabricType.add.map((a) => ({ pattern_id: patternId, fabrictype_id: a.id })),
          skipDuplicates: true,
        })]
      : []),
    ...(attribute.add.length
      ? [prisma.patternAttribute.createMany({
          data: attribute.add.map((a) => ({ pattern_id: patternId, attribute_id: a.id })),
          skipDuplicates: true,
        })]
      : []),
    ...(suggestedFabric.add.length
      ? [prisma.patternSuggestedFabric.createMany({
          data: suggestedFabric.add.map((a) => ({ pattern_id: patternId, suggestedfabric_id: a.id })),
          skipDuplicates: true,
        })]
      : []),
  ])

  return plan
}
