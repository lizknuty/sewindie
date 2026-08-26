/**
 * Reports what the GENERATED Prisma client actually contains.
 *
 * `db:check` inspects prisma/schema.prisma -- the source. This inspects the
 * client compiled from it, which is what TypeScript actually type-checks
 * against. The two disagree whenever `prisma generate` did not run, failed, or
 * ran against a different schema, and that gap is invisible to `db:check`.
 *
 * It reads from node_modules on disk, so it is unaffected by editor caching --
 * useful for telling "my client is stale" apart from "my IDE is stale".
 *
 *   node scripts/check-generated-client.mjs
 */

import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// Relation fields the application code expects to be lower-camelCase. Anything
// here that comes back capitalised means the client predates the schema fix.
const EXPECTED = {
  Collection: ["user", "patterns"],
  CollectionPattern: ["collection", "pattern"],
  Designer: ["patterns"],
  Favorite: ["pattern", "user"],
  Pattern: ["collections", "favorites", "designer", "ratings"],
  PatternAttribute: ["attribute", "pattern"],
  PatternAudience: ["audience", "pattern"],
  PatternCategory: ["category", "pattern"],
  PatternFabricType: ["fabricType", "pattern"],
  PatternSuggestedFabric: ["pattern", "suggestedFabric"],
  Rating: ["pattern", "user"],
  User: ["collections", "favorites", "ratings"],
}

let Prisma
try {
  ;({ Prisma } = require("@prisma/client"))
} catch (err) {
  console.error("Could not load @prisma/client.")
  console.error("Run `npm install` then `npx prisma generate`.\n")
  console.error(String(err.message || err))
  process.exit(1)
}

const dmmf = Prisma?.dmmf?.datamodel
if (!dmmf) {
  console.error("@prisma/client loaded but exposes no DMMF -- the client was never generated.")
  console.error("Run `npx prisma generate`.")
  process.exit(1)
}

let clientVersion = "unknown"
try {
  clientVersion = require("@prisma/client/package.json").version
} catch {
  /* non-fatal */
}

console.log(`Generated client: @prisma/client ${clientVersion}`)
console.log(`Models in client: ${dmmf.models.length}`)
console.log("-".repeat(50))

const missing = []

for (const [model, expectedFields] of Object.entries(EXPECTED)) {
  const found = dmmf.models.find((m) => m.name === model)
  if (!found) {
    missing.push(`${model}: model absent from the generated client`)
    continue
  }
  const relationNames = found.fields.filter((f) => f.kind === "object").map((f) => f.name)
  for (const field of expectedFields) {
    if (!relationNames.includes(field)) {
      // Surface the capitalised sibling so the message names the actual value.
      const wrong = relationNames.find((n) => n.toLowerCase() === field.toLowerCase())
      missing.push(
        wrong
          ? `${model}.${field} -- client has "${wrong}" instead`
          : `${model}.${field} -- absent (client has: ${relationNames.join(", ") || "none"})`,
      )
    }
  }
}

// Note: @updatedAt is deliberately NOT checked here. Prisma 7 ships a slimmed
// DMMF whose fields carry only { name, kind, type } -- the isUpdatedAt flag
// that earlier versions exposed is gone, so it cannot be detected from the
// client. `npm run db:check` verifies it against the schema instead.

if (missing.length === 0) {
  console.log("\nGenerated client matches what the app expects.")
  console.log("\nIf your editor still shows errors, the client on disk is fine and")
  console.log("your IDE is caching stale types. In VS Code run:")
  console.log('  Cmd/Ctrl+Shift+P -> "TypeScript: Restart TS Server"')
  console.log("\nTo confirm from the command line (authoritative):")
  console.log("  npx tsc --noEmit")
  process.exit(0)
}

console.log("\nGENERATED CLIENT IS OUT OF DATE:\n")
for (const m of missing) console.log("  " + m)
console.log("\nThe schema may be correct while the client is not -- `prisma generate`")
console.log("either did not run or failed. Rebuild it:\n")
console.log("  rm -rf node_modules/.prisma node_modules/@prisma/client")
console.log("  npm install")
console.log("  npx prisma generate")
console.log("  npx tsc --noEmit")
process.exit(1)
