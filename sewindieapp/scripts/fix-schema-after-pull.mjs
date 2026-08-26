/**
 * Repairs `prisma/schema.prisma` after `npx prisma db pull`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Relation field names and `@updatedAt` do not exist in Postgres. Introspection
 * therefore cannot recover them: it names every relation field after the model
 * it points at (`Pattern.Designer` instead of `Pattern.designer`) and drops
 * `@updatedAt` entirely. This repo's application code has always used the
 * lowercase names, so a raw pull breaks ~40 files.
 *
 * This script restores them. It is idempotent, so running it twice is a no-op.
 *
 *   npx prisma db pull
 *   node scripts/fix-schema-after-pull.mjs
 *   npx prisma generate
 *
 * Pass --check to print a diagnosis without writing anything.
 *
 * MATCHING STRATEGY
 * -----------------
 * Fields are located by (model, referenced type, list-ness) -- properties that
 * come from the foreign keys and so survive introspection -- never by the
 * field's own name. That way the script works regardless of what introspection
 * decided to call the field.
 *
 * IF YOU ADD A RELATION: add it to RELATION_FIELDS below, otherwise the next
 * pull will silently rename it and break the code that uses it.
 */

import { readFile, writeFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const args = process.argv.slice(2)
const CHECK_ONLY = args.includes("--check")
const SCHEMA_PATH = args.find((a) => !a.startsWith("--")) ?? "prisma/schema.prisma"

/**
 * model -> the relation fields it should expose.
 * `type` is the referenced model, `list` whether it is a to-many.
 * This table was derived by diffing pulled output against the known-good schema.
 */
const RELATION_FIELDS = {
  Collection: [
    { type: "User", list: false, name: "user" },
    { type: "CollectionPattern", list: true, name: "patterns" },
  ],
  CollectionPattern: [
    { type: "Collection", list: false, name: "collection" },
    { type: "Pattern", list: false, name: "pattern" },
  ],
  Designer: [{ type: "Pattern", list: true, name: "patterns" }],
  Favorite: [
    { type: "Pattern", list: false, name: "pattern" },
    { type: "User", list: false, name: "user" },
  ],
  Pattern: [
    { type: "CollectionPattern", list: true, name: "collections" },
    { type: "Favorite", list: true, name: "favorites" },
    { type: "Designer", list: false, name: "designer" },
    { type: "Rating", list: true, name: "ratings" },
  ],
  PatternAttribute: [
    { type: "Attribute", list: false, name: "attribute" },
    { type: "Pattern", list: false, name: "pattern" },
  ],
  PatternAudience: [
    { type: "Audience", list: false, name: "audience" },
    { type: "Pattern", list: false, name: "pattern" },
  ],
  PatternCategory: [
    { type: "Category", list: false, name: "category" },
    { type: "Pattern", list: false, name: "pattern" },
  ],
  PatternFabricType: [
    { type: "FabricType", list: false, name: "fabricType" },
    { type: "Pattern", list: false, name: "pattern" },
  ],
  PatternSuggestedFabric: [
    { type: "Pattern", list: false, name: "pattern" },
    { type: "SuggestedFabric", list: false, name: "suggestedFabric" },
  ],
  Rating: [
    { type: "Pattern", list: false, name: "pattern" },
    { type: "User", list: false, name: "user" },
  ],
  User: [
    { type: "Collection", list: true, name: "collections" },
    { type: "Favorite", list: true, name: "favorites" },
    { type: "Rating", list: true, name: "ratings" },
  ],
}

/**
 * Models whose `updatedAt` column must carry Prisma's `@updatedAt`.
 *
 * Collection is deliberately absent: its API routes set the timestamp
 * explicitly, so it does not depend on the attribute surviving a pull.
 */
const UPDATED_AT_MODELS = ["Rating", "User"]

function findModelBlock(schema, model) {
  const start = schema.search(new RegExp(`^model\\s+${model}\\s*\\{`, "m"))
  if (start === -1) return null
  const end = schema.indexOf("\n}", start)
  if (end === -1) return null
  return { start, end: end + 2, body: schema.slice(start, end + 2) }
}

/** Lines in `body` declaring a field of `type` with the given list-ness. */
function matchFieldLines(body, type, list) {
  const suffix = list ? "\\[\\]" : "(?!\\[\\])\\??"
  const re = new RegExp(`^([ \\t]*)([A-Za-z_]\\w*)([ \\t]+)${type}${suffix}(?=[ \\t]|$)`, "gm")
  const hits = []
  let m
  while ((m = re.exec(body))) {
    hits.push({ full: m[0], indent: m[1], field: m[2], gap: m[3], index: m.index })
  }
  return hits
}

function inspectRelations(schema) {
  const renames = []
  const alreadyOk = []
  const problems = []

  for (const [model, specs] of Object.entries(RELATION_FIELDS)) {
    const block = findModelBlock(schema, model)
    if (!block) {
      problems.push(`model ${model} not found in schema`)
      continue
    }
    for (const spec of specs) {
      const hits = matchFieldLines(block.body, spec.type, spec.list)
      if (hits.length === 0) {
        problems.push(
          `${model}: no ${spec.list ? "list" : "single"} field of type ${spec.type} (expected "${spec.name}")`,
        )
      } else if (hits.length > 1) {
        problems.push(
          `${model}: ${hits.length} fields of type ${spec.type} (${hits
            .map((h) => h.field)
            .join(", ")}) -- cannot disambiguate "${spec.name}" automatically`,
        )
      } else if (hits[0].field === spec.name) {
        alreadyOk.push(`${model}.${spec.name}`)
      } else {
        renames.push({ model, from: hits[0].field, to: spec.name, type: spec.type, list: spec.list })
      }
    }
  }
  return { renames, alreadyOk, problems }
}

function inspectUpdatedAt(schema) {
  const missing = []
  const alreadyOk = []
  const problems = []

  for (const model of UPDATED_AT_MODELS) {
    const block = findModelBlock(schema, model)
    if (!block) {
      problems.push(`model ${model} not found in schema`)
      continue
    }
    const line = block.body.split("\n").find((l) => /^\s*updatedAt\s/.test(l))
    if (!line) {
      problems.push(`${model}: no updatedAt field found`)
    } else if (/@updatedAt/.test(line)) {
      alreadyOk.push(`${model}.updatedAt`)
    } else {
      missing.push(model)
    }
  }
  return { missing, alreadyOk, problems }
}

function applyRelationRenames(schema, renames) {
  let out = schema
  for (const r of renames) {
    const block = findModelBlock(out, r.model)
    const suffix = r.list ? "\\[\\]" : "(?!\\[\\])\\??"
    const re = new RegExp(
      `^([ \\t]*)${r.from}([ \\t]+)(${r.type}${suffix})`,
      "m",
    )
    const patched = block.body.replace(re, `$1${r.to}$2$3`)
    out = out.slice(0, block.start) + patched + out.slice(block.end)
  }
  return out
}

function applyUpdatedAt(schema, models) {
  let out = schema
  for (const model of models) {
    const block = findModelBlock(out, model)
    // Appended at end of line rather than inserted after @default(...):
    // attribute order carries no meaning in Prisma, and matching a balanced
    // `@default(now())` with a regex is a trap -- `[^)]*` stops at the inner
    // paren and injects the attribute inside the call.
    const patched = block.body.replace(/^([ \t]*updatedAt[ \t]+DateTime[^\n]*?)[ \t]*$/m, (full, body) =>
      /@updatedAt/.test(body) ? full : `${body} @updatedAt`,
    )
    out = out.slice(0, block.start) + patched + out.slice(block.end)
  }
  return out
}

function report(label, items) {
  if (!items.length) return
  console.log(`\n${label}`)
  for (const i of items) console.log(`  ${i}`)
}

const original = await readFile(SCHEMA_PATH, "utf8")

const rel = inspectRelations(original)
const upd = inspectUpdatedAt(original)
const problems = [...rel.problems, ...upd.problems]

if (CHECK_ONLY) {
  console.log(`Diagnosing ${SCHEMA_PATH}\n${"-".repeat(50)}`)
  report(
    `Relation fields needing rename (${rel.renames.length}):`,
    rel.renames.map((r) => `${r.model}: ${r.from} -> ${r.to}${r.list ? "[]" : ""}`),
  )
  report(`Models needing @updatedAt (${upd.missing.length}):`, upd.missing)
  report(`Already correct (${rel.alreadyOk.length + upd.alreadyOk.length}):`, [
    ...rel.alreadyOk,
    ...upd.alreadyOk,
  ])
  report(`Problems (${problems.length}):`, problems)
  console.log(
    `\n${problems.length ? "Schema does not match the expected shape -- see problems above." : "Schema shape recognised."}`,
  )
  process.exit(problems.length ? 1 : 0)
}

if (problems.length) {
  report("Cannot proceed -- unexpected schema shape:", problems)
  console.error(
    "\nNo changes written. Run with --check for detail, and update RELATION_FIELDS " +
      "in this script if the schema legitimately changed.",
  )
  process.exit(1)
}

if (!rel.renames.length && !upd.missing.length) {
  console.log("Schema already correct -- nothing to do.")
  process.exit(0)
}

let patched = applyRelationRenames(original, rel.renames)
patched = applyUpdatedAt(patched, upd.missing)
await writeFile(SCHEMA_PATH, patched, "utf8")

for (const r of rel.renames) {
  console.log(`  renamed ${r.model}.${r.from} -> ${r.to}${r.list ? "[]" : ""}`)
}
for (const m of upd.missing) {
  console.log(`  restored @updatedAt on ${m}.updatedAt`)
}

// `prisma format` failing is a red flag, not a cosmetic miss -- it means the
// rewrite produced something Prisma cannot parse. Surface it loudly.
let formatFailed = null
try {
  await execFileAsync("npx", ["prisma", "format", "--schema", SCHEMA_PATH])
} catch (err) {
  formatFailed = err.stderr || err.stdout || String(err)
}

// Re-read and re-inspect, so the script can never report success while leaving
// the schema in a state that would still break the build.
const verify = await readFile(SCHEMA_PATH, "utf8")
const vRel = inspectRelations(verify)
const vUpd = inspectUpdatedAt(verify)
const stillWrong = [
  ...vRel.renames.map((r) => `${r.model}.${r.from} is still not "${r.to}"`),
  ...vUpd.missing.map((m) => `${m}.updatedAt is still missing @updatedAt`),
  ...vRel.problems,
  ...vUpd.problems,
]

if (stillWrong.length) {
  report("VERIFICATION FAILED:", stillWrong)
  process.exit(1)
}

// Name checks alone are not enough: they pass happily on a schema that Prisma
// cannot parse. Ask Prisma itself whether the result is valid.
let validateError = null
try {
  await execFileAsync("npx", ["prisma", "validate", "--schema", SCHEMA_PATH])
} catch (err) {
  validateError = err.stdout || err.stderr || String(err)
}

if (formatFailed || validateError) {
  console.error("\nVERIFICATION FAILED: the rewritten schema is not valid Prisma.")
  console.error(validateError || formatFailed)
  console.error(
    `\n${SCHEMA_PATH} has been modified and is currently broken. ` +
      "Restore it with `npx prisma db pull` and report this output.",
  )
  process.exit(1)
}

console.log(
  `\nDone: ${rel.renames.length} relation field(s) renamed, ${upd.missing.length} @updatedAt restored.`,
)
console.log("Schema validated. Next: npx prisma generate")
