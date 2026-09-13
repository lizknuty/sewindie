/**
 * One-time Mimoï DB cleanup (dry-run by default; set EXECUTE=1 to mutate).
 *
 * Reconciles two generations of Mimoï rows:
 *  - OLD  rows: dead WooCommerce URLs (/produit/...), have categories/formats/
 *               audiences, garment embedded in name.
 *  - NEW  rows: live Shopify URLs (/products/...-patron-...-pdf), release date,
 *               correct accents, NO categories.
 *
 * Strategy (user-approved):
 *  - Match DB rows to the live feed by a garment-stripped token-SET key.
 *  - Display name always comes from the feed's cleaned name (reliable).
 *  - PAIR (old+new): merge old's categories/formats/audiences onto the new row,
 *    rename new row to feed name, delete the old row.
 *  - NEW-only: rename to feed name, infer categories from the Shopify handle.
 *  - OLD-only that matches a feed item: rename to feed name, adopt live URL +
 *    release date + thumbnail, keep its categories.
 *  - OLD-only with NO feed match: rename via best-effort garment strip (flagged).
 *  - Feed items matching nothing in DB: reported only (left for normal sync).
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { mimoiAdapter } from "../app/lib/pattern-sync/adapters/mimoi"

const EXECUTE = process.env.EXECUTE === "1"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING }),
})

const fold = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

// Structured token sets. STRIP (used to build a match key) is the union.
// Note: bare "a" is intentionally NOT a connector here — it corrupts names
// like "Versions A Et B".
const CONNECTORS = new Set([
  "de", "du", "des", "la", "le", "les", "et", "ou", "au", "aux", "en", "pour",
])
const PATTERN_WORDS = new Set([
  "patron", "patrons", "couture", "pdf", "pochette", "papier", "sewing", "pattern",
])
const AUDIENCES = new Set([
  "femme", "femmes", "homme", "hommes", "enfant", "enfants", "bebe", "bebes",
  "fille", "filles", "garcon", "garcons", "mixte", "adulte", "adultes",
])
const GARMENTS = new Set([
  "robe", "robes", "blouse", "blouses", "top", "tops", "tee", "teeshirt", "tshirt",
  "shirt", "debardeur", "caraco", "chemise", "chemisier", "chemisiers",
  "surchemise", "tunique", "jupe", "jupes", "jupette", "pantalon", "pantalons",
  "short", "shorts", "combinaison", "combinaisons", "combi", "salopette",
  "veste", "vestes", "blazer", "manteau", "manteaux", "cape", "gilet",
  "cardigan", "pull", "sweat", "sweatshirt", "kimono", "peignoir", "maillot",
  "body", "barboteuse", "pyjama", "legging", "leggings", "poncho", "sac",
  "bonnet", "accessoire", "accessoires", "jogging", "sarouel",
])
const STRIP = new Set([...CONNECTORS, ...PATTERN_WORDS, ...AUDIENCES, ...GARMENTS])

// French garment token -> category id (see category list; conservative).
const GARMENT_CAT: Record<string, number> = {
  robe: 9, robes: 9,
  blouse: 30, blouses: 30, top: 30, tops: 30, tee: 30, teeshirt: 30, tshirt: 30,
  debardeur: 30, caraco: 30, chemisier: 30, chemise: 30,
  jupe: 24, jupes: 24, jupette: 24,
  pantalon: 19, pantalons: 19, sarouel: 19,
  short: 22, shorts: 22,
  combinaison: 13, combinaisons: 13,
  salopette: 18,
  veste: 6, vestes: 6, manteau: 6, manteaux: 6, cape: 6,
  gilet: 32,
  cardigan: 28, pull: 28, sweat: 28, sweatshirt: 28,
  kimono: 21, peignoir: 21,
  maillot: 29,
  body: 5,
  barboteuse: 16,
  pyjama: 26,
  legging: 14, leggings: 14,
  poncho: 20,
  sac: 3,
  bonnet: 4,
  accessoire: 1, accessoires: 1,
}

const tokens = (name: string) =>
  fold(name)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)

// Match key = sorted set of non-stripped tokens. Falls back to the full folded
// name if stripping leaves nothing (e.g. a design literally named "Robe").
const matchKey = (name: string) => {
  const all = tokens(name)
  const kept = all.filter((t) => !STRIP.has(t))
  const use = kept.length ? kept : all
  return Array.from(new Set(use)).sort().join(" ")
}

// Best-effort display name for an OLD row with no feed match: only rewrite when
// a garment token is actually present; otherwise keep the legacy name as-is.
const stripForDisplay = (name: string) => {
  const toks = tokens(name)
  if (!toks.some((t) => GARMENTS.has(t))) return name // nothing to normalize
  let kept = toks.filter(
    (t) => !GARMENTS.has(t) && !PATTERN_WORDS.has(t) && !AUDIENCES.has(t),
  )
  while (kept.length && CONNECTORS.has(kept[0])) kept = kept.slice(1)
  while (kept.length && CONNECTORS.has(kept[kept.length - 1])) kept = kept.slice(0, -1)
  if (!kept.length) return name
  return kept.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")
}

const handleOf = (url: string) => {
  const m = url.match(/\/products\/([^/?#]+)/)
  return m ? m[1] : ""
}

// Infer category ids from a Shopify handle like
// "wishing-girl-patron-blouse-robe-jupe-pdf".
const inferCats = (handle: string): number[] => {
  const ids = new Set<number>()
  for (const tok of handle.split("-")) {
    const id = GARMENT_CAT[tok]
    if (id) ids.add(id)
  }
  return Array.from(ids)
}

async function main() {
  const designer = await prisma.designer.findFirst({
    where: { name: "Mimoï" },
    select: { id: true, name: true },
  })
  if (!designer) throw new Error("Mimoï designer not found")

  const rows = await prisma.pattern.findMany({
    where: { designer_id: designer.id },
    select: {
      id: true, name: true, url: true, release_date: true, thumbnail_url: true,
      PatternCategory: { select: { category_id: true } },
      PatternFormat: { select: { format_id: true } },
      PatternAudience: { select: { audience_id: true } },
    },
    orderBy: { id: "asc" },
  })

  const feed = await mimoiAdapter.fetchCatalogue()
  const feedByKey = new Map<string, (typeof feed)[number]>()
  for (const f of feed) {
    const k = matchKey(f.name)
    if (!feedByKey.has(k)) feedByKey.set(k, f)
  }

  const isOld = (u: string) => /\/produit\//.test(u)
  const catName = new Map<number, string>()
  for (const c of await prisma.category.findMany({ select: { id: true, name: true } }))
    catName.set(c.id, c.name)

  // Group DB rows by match key.
  const dbByKey = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = matchKey(r.name)
    if (!dbByKey.has(k)) dbByKey.set(k, [])
    dbByKey.get(k)!.push(r)
  }

  type Plan = {
    kind: "PAIR" | "NEW_ONLY" | "OLD_ONLY_FEED" | "OLD_ONLY_NOFEED"
    keepId: number
    keepFrom: string
    newName: string
    setUrl?: string
    setRelease?: Date | null
    setThumb?: string | null
    addCats: number[]
    deleteIds: number[]
    note?: string
  }
  const plans: Plan[] = []
  const matchedFeedKeys = new Set<string>()

  for (const [key, group] of dbByKey) {
    const olds = group.filter((r) => isOld(r.url))
    const news = group.filter((r) => !isOld(r.url))
    const f = feedByKey.get(key)
    if (f) matchedFeedKeys.add(key)

    const unionCats = Array.from(
      new Set(group.flatMap((r) => r.PatternCategory.map((c) => c.category_id))),
    )
    const unionFmts = Array.from(
      new Set(group.flatMap((r) => r.PatternFormat.map((c) => c.format_id))),
    )
    const unionAuds = Array.from(
      new Set(group.flatMap((r) => r.PatternAudience.map((c) => c.audience_id))),
    )

    if (news.length && olds.length) {
      const keep = news[0]
      const feedName = f ? f.name : keep.name
      const missingCats = unionCats.filter(
        (id) => !keep.PatternCategory.some((c) => c.category_id === id),
      )
      plans.push({
        kind: "PAIR",
        keepId: keep.id,
        keepFrom: keep.name,
        newName: feedName,
        addCats: missingCats,
        deleteIds: group.filter((r) => r.id !== keep.id).map((r) => r.id),
        note:
          `union fmts=[${unionFmts.map((i) => i).join(",")}] auds=[${unionAuds.join(",")}]` +
          (news.length > 1 ? ` (+${news.length - 1} extra new merged)` : ""),
      })
    } else if (news.length && !olds.length) {
      const keep = news[0]
      const feedName = f ? f.name : keep.name
      const inferred = f ? inferCats(handleOf(f.url)) : []
      const have = new Set(keep.PatternCategory.map((c) => c.category_id))
      const addCats = inferred.filter((id) => !have.has(id))
      plans.push({
        kind: "NEW_ONLY",
        keepId: keep.id,
        keepFrom: keep.name,
        newName: feedName,
        addCats,
        deleteIds: group.filter((r) => r.id !== keep.id).map((r) => r.id),
        note: f
          ? `infer from handle "${handleOf(f.url)}"`
          : "NO feed match (name unchanged)",
      })
    } else {
      // old-only
      const keep = olds[0]
      if (f) {
        plans.push({
          kind: "OLD_ONLY_FEED",
          keepId: keep.id,
          keepFrom: keep.name,
          newName: f.name,
          setUrl: f.url,
          setRelease: f.releaseDate ? new Date(f.releaseDate) : keep.release_date,
          setThumb: f.imageUrl ?? keep.thumbnail_url,
          addCats: [],
          deleteIds: olds.slice(1).map((r) => r.id),
          note: "adopt live URL + release + thumb; keep categories",
        })
      } else {
        // Only rewrite when a garment is embedded; otherwise keep legacy name.
        plans.push({
          kind: "OLD_ONLY_NOFEED",
          keepId: keep.id,
          keepFrom: keep.name,
          newName: stripForDisplay(keep.name),
          addCats: [],
          deleteIds: olds.slice(1).map((r) => r.id),
          note: "no feed match; garment-only strip (REVIEW)",
        })
      }
    }
  }

  const feedUnmatched = feed.filter((f) => !matchedFeedKeys.has(matchKey(f.name)))

  // ---- report ----
  const order = ["PAIR", "OLD_ONLY_FEED", "NEW_ONLY", "OLD_ONLY_NOFEED"] as const
  for (const kind of order) {
    const group = plans.filter((p) => p.kind === kind)
    console.log(`\n===== ${kind} (${group.length}) =====`)
    for (const p of group) {
      const rename = p.keepFrom !== p.newName ? `"${p.keepFrom}" -> "${p.newName}"` : `"${p.newName}" (unchanged)`
      const cats = p.addCats.length ? ` +cats[${p.addCats.map((i) => catName.get(i) ?? i).join(", ")}]` : ""
      const del = p.deleteIds.length ? ` DELETE ids[${p.deleteIds.join(",")}]` : ""
      const url = p.setUrl ? ` URL->live` : ""
      console.log(`  #${p.keepId} ${rename}${cats}${url}${del}  {${p.note}}`)
    }
  }
  console.log(`\n===== FEED UNMATCHED (genuinely new, left for sync) (${feedUnmatched.length}) =====`)
  for (const f of feedUnmatched) console.log(`  ${f.name}  (${handleOf(f.url)})`)

  const totalDeletes = plans.reduce((n, p) => n + p.deleteIds.length, 0)
  const totalRenames = plans.filter((p) => p.keepFrom !== p.newName).length
  const totalCatAdds = plans.reduce((n, p) => n + p.addCats.length, 0)
  console.log(
    `\nSUMMARY: ${rows.length} db rows | renames=${totalRenames} | catAdds=${totalCatAdds} | deletes=${totalDeletes} | feedUnmatched=${feedUnmatched.length}`,
  )

  if (!EXECUTE) {
    console.log("\n(DRY RUN — set EXECUTE=1 to apply)")
    await prisma.$disconnect()
    return
  }

  console.log("\nEXECUTING in a transaction...")
  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      const data: Record<string, unknown> = {}
      if (p.keepFrom !== p.newName) data.name = p.newName
      if (p.setUrl) data.url = p.setUrl
      if (p.setRelease !== undefined) data.release_date = p.setRelease
      if (p.setThumb !== undefined) data.thumbnail_url = p.setThumb
      if (Object.keys(data).length) await tx.pattern.update({ where: { id: p.keepId }, data })

      for (const catId of p.addCats) {
        await tx.patternCategory.upsert({
          where: { pattern_id_category_id: { pattern_id: p.keepId, category_id: catId } },
          create: { pattern_id: p.keepId, category_id: catId },
          update: {},
        })
      }
      for (const delId of p.deleteIds) {
        await tx.patternCategory.deleteMany({ where: { pattern_id: delId } })
        await tx.patternFormat.deleteMany({ where: { pattern_id: delId } })
        await tx.patternAudience.deleteMany({ where: { pattern_id: delId } })
        await tx.patternAttribute.deleteMany({ where: { pattern_id: delId } })
        await tx.patternFabricType.deleteMany({ where: { pattern_id: delId } })
        await tx.patternSuggestedFabric.deleteMany({ where: { pattern_id: delId } })
        await tx.pattern.delete({ where: { id: delId } })
      }
    }
  })
  console.log("DONE.")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
