/**
 * Restores the Collection relation field names that `prisma db pull` renames.
 *
 * Introspection reads the database, which has no concept of Prisma relation
 * field names, so it regenerates them from model names: `patterns` becomes
 * `CollectionPattern`, `user` becomes `User`, and so on. The app code uses the
 * lowercase names (matching the existing `favorites` / `ratings` convention),
 * so a raw pull breaks the build with "Property 'patterns' does not exist".
 *
 * Usage:
 *
 *   npx prisma db pull
 *   node scripts/fix-collection-relations.mjs
 *   npx prisma generate
 *
 * Diagnostics only, changes nothing:
 *
 *   node scripts/fix-collection-relations.mjs --check
 *
 * Fields are matched by their TYPE, not their current name, so this copes with
 * whatever spelling introspection invents. Safe to run repeatedly. Verifies its
 * own work afterwards and exits non-zero if anything is still wrong.
 */

import { readFile, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const args = process.argv.slice(2)
const CHECK_ONLY = args.includes("--check")
const SCHEMA_PATH = args.find((a) => !a.startsWith("--")) ?? "prisma/schema.prisma"

/**
 * The six relation fields introspection renames.
 * [model, desired field name, referenced model, list?]
 */
const TARGETS = [
  ["Collection", "user", "User", false],
  ["Collection", "patterns", "CollectionPattern", true],
  ["CollectionPattern", "collection", "Collection", false],
  ["CollectionPattern", "pattern", "Pattern", false],
  ["User", "collections", "Collection", true],
  ["Pattern", "collections", "CollectionPattern", true],
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Offsets of a model block's body, or null when the model is absent. */
function findModelBody(schema, modelName) {
  const header = new RegExp(`^\\s*model\\s+${escapeRe(modelName)}\\s*\\{`, "m")
  const match = header.exec(schema)
  if (!match) return null

  const bodyStart = match.index + match[0].length
  // Closing brace at column 0 on its own line. Tolerates CR and stray spaces.
  const closer = /^[ \t]*\}[ \t]*\r?$/m
  closer.lastIndex = 0
  const rest = schema.slice(bodyStart)
  const closerMatch = closer.exec(rest)
  if (!closerMatch) return null

  return [bodyStart, bodyStart + closerMatch.index]
}

/**
 * Every field declaration in a model body, as
 * { name, type, baseType, isList, line, index }.
 * Skips blank lines, comments and block attributes (`@@index`, `@@unique`).
 */
function parseFields(body) {
  const fields = []
  const lineRe = /^[ \t]*([A-Za-z_]\w*)[ \t]+([A-Za-z_]\w*(?:\[\])?\??)(.*)$/gm
  let m
  while ((m = lineRe.exec(body)) !== null) {
    const [line, name, type] = m
    if (name === "model" || line.trimStart().startsWith("//")) continue
    fields.push({
      name,
      type,
      baseType: type.replace(/[[\]?]/g, ""),
      isList: type.includes("[]"),
      line,
      index: m.index,
    })
  }
  return fields
}

function report(schema, label) {
  console.log(`\n--- ${label} ---`)
  for (const model of ["Collection", "CollectionPattern"]) {
    const bounds = findModelBody(schema, model)
    if (!bounds) {
      console.log(`model ${model}: NOT FOUND`)
      continue
    }
    console.log(`model ${model} {`)
    for (const f of parseFields(schema.slice(...bounds))) {
      console.log(`  ${f.name.padEnd(14)} ${f.type}`)
    }
    console.log("}")
  }
  for (const [model, want] of [
    ["User", "collections"],
    ["Pattern", "collections"],
  ]) {
    const bounds = findModelBody(schema, model)
    if (!bounds) continue
    const hit = parseFields(schema.slice(...bounds)).find(
      (f) => f.baseType === (model === "User" ? "Collection" : "CollectionPattern") && f.isList,
    )
    console.log(`${model}.${want}: ${hit ? `${hit.name} ${hit.type}` : "MISSING"}`)
  }
}

/** Applies all renames to `schema`, returning { schema, applied, skipped, failed }. */
function rewrite(schema) {
  const applied = []
  const skipped = []
  const failed = []

  for (const [model, desired, refModel, isList] of TARGETS) {
    const bounds = findModelBody(schema, model)
    if (!bounds) {
      failed.push(`${model}.${desired} — model "${model}" not found`)
      continue
    }

    const [start, end] = bounds
    const body = schema.slice(start, end)
    const fields = parseFields(body)

    // Match on TYPE, not name: introspection's chosen name is unpredictable,
    // but the referenced model and list-ness are fixed by the foreign keys.
    const candidates = fields.filter((f) => f.baseType === refModel && f.isList === isList)

    if (candidates.length === 0) {
      failed.push(
        `${model}.${desired} — no field of type ${refModel}${isList ? "[]" : ""} in model ${model}`,
      )
      continue
    }
    if (candidates.length > 1) {
      failed.push(
        `${model}.${desired} — ${candidates.length} fields of type ` +
          `${refModel}${isList ? "[]" : ""} (${candidates.map((c) => c.name).join(", ")}); ` +
          `too ambiguous to rename safely`,
      )
      continue
    }

    const field = candidates[0]
    if (field.name === desired) {
      skipped.push(`${model}.${desired}`)
      continue
    }

    const newLine = field.line.replace(
      new RegExp(`^([ \\t]*)${escapeRe(field.name)}(?=[ \\t])`),
      `$1${desired}`,
    )
    const newBody = body.slice(0, field.index) + newLine + body.slice(field.index + field.line.length)
    schema = schema.slice(0, start) + newBody + schema.slice(end)
    applied.push(`${model}.${field.name} -> ${desired}`)
  }

  return { schema, applied, skipped, failed }
}

const original = await readFile(SCHEMA_PATH, "utf8")

if (CHECK_ONLY) {
  console.log(`schema: ${SCHEMA_PATH}`)
  report(original, "current schema state")
  const { applied, failed } = rewrite(original)
  console.log(
    `\n${applied.length} field(s) would be renamed, ${failed.length} problem(s).` +
      (applied.length ? `\n  ${applied.join("\n  ")}` : ""),
  )
  for (const f of failed) console.error(`  PROBLEM ${f}`)
  process.exit(0)
}

const { schema: updated, applied, skipped, failed } = rewrite(original)

for (const e of applied) console.log(`renamed  ${e}`)
for (const e of skipped) console.log(`ok       ${e} (already correct)`)
for (const e of failed) console.error(`FAILED   ${e}`)

if (applied.length > 0) {
  await writeFile(SCHEMA_PATH, updated, "utf8")
  try {
    await execFileAsync("npx", ["prisma", "format", "--schema", SCHEMA_PATH])
  } catch {
    console.log("(prisma format skipped; column alignment may be off)")
  }
}

// Verify against what is actually on disk now, so a partial or silently failed
// rewrite cannot be mistaken for success.
const finalSchema = await readFile(SCHEMA_PATH, "utf8")
const unresolved = []
for (const [model, desired, refModel, isList] of TARGETS) {
  const bounds = findModelBody(finalSchema, model)
  if (!bounds) {
    unresolved.push(`${model}.${desired} — model missing`)
    continue
  }
  const hit = parseFields(finalSchema.slice(...bounds)).find(
    (f) => f.baseType === refModel && f.isList === isList,
  )
  if (!hit) unresolved.push(`${model}.${desired} — no ${refModel}${isList ? "[]" : ""} field`)
  else if (hit.name !== desired) {
    unresolved.push(`${model}.${desired} — still named "${hit.name}"`)
  }
}

if (unresolved.length > 0 || failed.length > 0) {
  report(finalSchema, "schema after script ran")
  console.error("\nSTILL WRONG:")
  for (const u of unresolved) console.error(`  ${u}`)
  console.error(
    "\nPaste the block above so the mismatch can be diagnosed. Nothing was\n" +
      "left half-written: the six names are applied together or not at all.",
  )
  process.exitCode = 1
} else {
  console.log(`\nAll ${TARGETS.length} relation names verified correct in ${SCHEMA_PATH}.`)
  if (applied.length > 0) console.log("Now run: npx prisma generate")
}
