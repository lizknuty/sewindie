// Lets plain `node` run the project's TypeScript directly.
//
// Node 24 strips types on its own, but it still requires a file extension on
// relative imports, while the app is written for a bundler and omits them
// ("./adapters/patterns-for-pirates"). This hook retries a failed relative
// resolution with `.ts`, `.tsx` and `/index.ts`, and maps the `@/*` alias onto
// `app/*` the way tsconfig does -- so one-off scripts can import the real
// application modules instead of a copy that might drift from them.
//
// Used via: node --import ./scripts/ts-resolve-hook.mjs <script>

import { register } from "node:module"
import { pathToFileURL } from "node:url"

const APP_ROOT = new URL("../app/", import.meta.url).href

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx", ".mts", ".js"]

function hookSource() {
  return `
    const APP_ROOT = ${JSON.stringify(APP_ROOT)}
    const SUFFIXES = ${JSON.stringify(CANDIDATE_SUFFIXES)}

    export async function resolve(specifier, context, nextResolve) {
      // tsconfig maps "@/*" to "./app/*".
      let spec = specifier
      if (spec.startsWith("@/")) {
        spec = new URL(spec.slice(2), APP_ROOT).href
      }

      try {
        return await nextResolve(spec, context)
      } catch (error) {
        const isRelative = spec.startsWith(".") || spec.startsWith("file:")
        if (!isRelative) throw error
        for (const suffix of SUFFIXES) {
          try {
            return await nextResolve(spec + suffix, context)
          } catch {}
        }
        throw error
      }
    }
  `
}

register(`data:text/javascript,${encodeURIComponent(hookSource())}`, pathToFileURL("./"))
