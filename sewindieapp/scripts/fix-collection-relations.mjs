/**
 * Restores the Collection relation field names that `prisma db pull` renames.
 *
 * Introspection reads the database, which has no concept of Prisma relation
 * field names, so it regenerates them from model names: `patterns` becomes
 * `CollectionPattern`, `user` becomes `User`, and so on. The app code uses the
 * lowercase names (matching the existing `favorites` / `ratings` convention),
 * so a raw pull breaks the build with "Property 'patterns' does not exist".
 *
 * Prisma's re-introspection normally preserves manual renames, but it can only
 * do that for fields already present in the file -- which is why the very first
 * pull after these models were added produced default names.
 *
 * Run this after every `prisma db pull`, then `prisma generate`:
 *
 *   npx prisma db pull
 *   node scripts/fix-collection-relations.mjs
 *   npx prisma generate
 *
 * Safe to run repeatedly: fields already carrying the correct name are skipped.
 */

import { readFile, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
// Path override exists so the script can be exercised against a copy.
const SCHEMA_PATH = process.argv[2] ?? "prisma/schema.prisma"

/** [model, name introspection produces, name the app code expects, field type] */
const RENAMES = [
  ["Collection", "User", "user", "User"],
  ["Collection", "CollectionPattern", "patterns", "CollectionPattern[]"],
  ["CollectionPattern", "Collection", "collection", "Collection"],
  ["CollectionPattern", "Pattern", "pattern", "Pattern"],
  ["User", "Collection", "collections", "Collection[]"],
  ["Pattern", "CollectionPattern", "collections", "CollectionPattern[]"],
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Returns [start, end) offsets of a model block's body, or null when the model
 * is absent. Scoping edits to one block stops a rename in `User` from also
 * rewriting the identically-named field in `Collection`.
 */
function findModelBody(schema, modelName) {
  const header = new RegExp(`^model\\s+${escapeRe(modelName)}\\s*\\{`, "m")
  const match = header.exec(schema)
  if (!match) return null

  const bodyStart = match.index + match[0].length
  const bodyEnd = schema.indexOf("\n}", bodyStart)
  if (bodyEnd === -1) return null

  return [bodyStart, bodyEnd]
}

let schema = await readFile(SCHEMA_PATH, "utf8")
const applied = []
const skipped = []
const failed = []

for (const [model, from, to, type] of RENAMES) {
  const bounds = findModelBody(schema, model)
  if (!bounds) {
    failed.push(`${model}.${to} — model "${model}" not found`)
    continue
  }

  const [start, end] = bounds
  const body = schema.slice(start, end)

  // Already correct (either never pulled, or a previous run fixed it).
  if (new RegExp(`^\\s*${escapeRe(to)}\\s+${escapeRe(type)}(\\s|$)`, "m").test(body)) {
    skipped.push(`${model}.${to}`)
    continue
  }

  // Match on BOTH the field name and its type. The name alone is ambiguous:
  // `Collection` inside model User is a relation field, but a bare name match
  // could also hit an unrelated field that happens to share the identifier.
  const field = new RegExp(`^(\\s*)${escapeRe(from)}(\\s+)(${escapeRe(type)})`, "m")
  if (!field.test(body)) {
    failed.push(`${model}.${from} (${type}) — field not found`)
    continue
  }

  const newBody = body.replace(field, `$1${to}$2$3`)
  schema = schema.slice(0, start) + newBody + schema.slice(end)
  applied.push(`${model}.${from} -> ${to}`)
}

if (applied.length > 0) {
  await writeFile(SCHEMA_PATH, schema, "utf8")
}

for (const entry of applied) console.log(`renamed  ${entry}`)
for (const entry of skipped) console.log(`ok       ${entry} (already correct)`)
for (const entry of failed) console.error(`FAILED   ${entry}`)

if (failed.length > 0) {
  console.error(
    `\n${failed.length} field(s) could not be rewritten. The schema may have ` +
      `changed shape -- fix these by hand and check this script still matches.`,
  )
  process.exitCode = 1
} else if (applied.length === 0) {
  console.log("\nNothing to do; all relation names already correct.")
} else {
  // Realign the columns the renames just knocked out of true.
  try {
    await execFileAsync("npx", ["prisma", "format", "--schema", SCHEMA_PATH])
    console.log("\nFormatted schema. Now run: npx prisma generate")
  } catch {
    console.log("\nRun: npx prisma format && npx prisma generate")
  }
}
