// Bundle the Firebase AI Logic SDK into one ES module MV3 pages can import statically.
//
// Why: Chrome MV3 service workers and extension pages cannot resolve bare specifiers
// ("firebase/ai") — the module graph must be flattened before loading. esbuild does that
// while keeping ESM output (type: "module" entry points).
//
// Output: src/lib/firebase-ai-logic.bundle.js (+ .map), emitted NEXT TO its source module
// so every importer in the package resolves it with one uniform relative specifier
// ("../lib/firebase-ai-logic.bundle.js"). MV3 permits JS anywhere inside the unpacked
// extension directory; the source firebase-ai-logic.js remains alongside for reviewers.
//
// Usage:  node tools/bundle-ai.mjs   (or npm run build:ai)

import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

const libDir = new URL('../src/lib/', import.meta.url)

mkdirSync(libDir, { recursive: true })

const outfile = new URL('./firebase-ai-logic.bundle.js', libDir).pathname.replace(/^\/([A-Za-z]:)/, '$1')

await build({
  entryPoints: [new URL('../src/lib/firebase-ai-logic.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  bundle: true,
  format: 'esm',
  target: ['chrome139'],
  platform: 'browser',
  outfile,
  sourcemap: true,
  logLevel: 'info',
  // firebase SDKs use dynamic feature detection; keep their guards intact
  legalComments: 'none'
})

console.log('[bundle-ai] wrote src/lib/firebase-ai-logic.bundle.js')