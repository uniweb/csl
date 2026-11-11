#!/usr/bin/env node

/**
 * Build script for citestyle
 *
 * Writes locales/<lang>.js, a re-export of each @citestyle/locales pack, so that
 * `import fr from 'citestyle/locales/fr-FR'` works with only `citestyle` installed. The list
 * comes from the packs' published index (@citestyle/locales/locales/v1/index.json): every
 * locale, and every language code that names its primary dialect (fr → fr-FR).
 *
 * Usage:
 *   node build.js
 */

import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const OUT = join(__dirname, 'locales')

const index = JSON.parse(readFileSync(require.resolve('@citestyle/locales/locales/v1/index.json'), 'utf8'))
const names = new Set(Object.keys(index.locales))
for (const [language, primary] of Object.entries(index.languages)) {
  if (language !== primary && !names.has(language) && names.has(primary)) names.add(language)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const name of [...names].sort()) {
  writeFileSync(join(OUT, `${name}.js`), `export { default } from '@citestyle/locales/${name}'\n`)
}
console.log(`${names.size} locale re-exports → locales/`)
