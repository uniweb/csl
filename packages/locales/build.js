#!/usr/bin/env node

/**
 * Build script for @citestyle/locales
 *
 * Generates, from the CSL locale files in vendor/ (see generate.js):
 *
 *   dist/<lang>.js                 one ES module per locale, its pack as the default export
 *   dist/<language>.js             the pack of a language's primary dialect (fr → fr-FR)
 *   dist/locales/v1/<lang>.json    the same packs as JSON, to serve as static files
 *   dist/locales/v1/index.json     the locales, their primary-dialect fallbacks, the sources
 *
 * The JSON layout and the pack format (version 1) are a published contract: see README.md.
 *
 * Usage:
 *   node build.js           # into dist/
 *   node build.js <dir>     # into another directory
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPacks, buildIndex, packModule } from './generate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, 'dist')
const JSON_DIR = join(DIST, 'locales', 'v1')

const built = buildPacks()
rmSync(DIST, { recursive: true, force: true })
mkdirSync(JSON_DIR, { recursive: true })

for (const [lang, pack] of built.packs) {
  writeFileSync(join(DIST, `${lang}.js`), packModule(lang, pack, built.info.get(lang), built.source))
  writeFileSync(join(JSON_DIR, `${lang}.json`), JSON.stringify(pack))
}
for (const [language, lang] of built.aliases) {
  writeFileSync(join(DIST, `${language}.js`), `// ${language}: CSL's primary dialect, ${lang}\nexport { default } from './${lang}.js'\n`)
}
writeFileSync(join(JSON_DIR, 'index.json'), JSON.stringify(buildIndex(built), null, 2) + '\n')

console.log(`${built.packs.size} locale packs (+ ${built.aliases.size} language aliases) → ${DIST}`)
