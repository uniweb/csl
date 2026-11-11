#!/usr/bin/env node

/**
 * Build script for @citestyle/styles
 *
 * Compiles CSL XML source files into JavaScript modules using the
 * @citestyle/compiler. The CSL sources live in test/fixtures/ at the
 * monorepo root — these are the canonical CSL style definitions.
 *
 * Each compiled style is a self-contained ES module (~3-50KB) that
 * exports { meta, bibliography, citation, bibliographySort }.
 *
 * Usage:
 *   node build.js           # Compile all styles listed in STYLES
 *   node build.js --clean   # Remove compiled files first
 */

import { execSync } from 'node:child_process'
import { existsSync, unlinkSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const FIXTURES = join(ROOT, 'test/fixtures')
const CLI = join(ROOT, 'packages/compiler/src/cli.js')

/**
 * Styles to compile.
 *
 * Each entry names a CSL file in test/fixtures/ and the module compiled from it, or is
 * [name, locale] for a style compiled with a default locale other than its own default-locale.
 * The name must match the exports map in package.json.
 *
 * To add a new style:
 * 1. Add the .csl file to test/fixtures/
 * 2. Add an entry here
 * 3. Add the export to package.json: "./name": "./name.js"
 */
const STYLES = [
  // Core academic styles
  'apa',
  'mla',
  'chicago-author-date',
  'ieee',
  'vancouver',
  // Cite Them Right is a British guide, and its style names no default-locale: British English
  // ("1 March 2024", ‘single quotes’, "edn") is what the module formats in without a pack
  ['harvard', 'en-GB'],

  // Additional popular styles
  'ama',
  'nature',
  'science',
]

// Parse args
const args = process.argv.slice(2)
const clean = args.includes('--clean')

if (clean) {
  console.log('Cleaning compiled styles...')
  for (const file of readdirSync(__dirname)) {
    if (file.endsWith('.js') && file !== 'build.js') {
      unlinkSync(join(__dirname, file))
      console.log(`  Removed ${file}`)
    }
  }
}

console.log(`Compiling ${STYLES.length} styles...\n`)

let failed = 0

for (const entry of STYLES) {
  const [style, locale] = Array.isArray(entry) ? entry : [entry]
  const input = join(FIXTURES, `${style}.csl`)
  const output = join(__dirname, `${style}.js`)

  if (!existsSync(input)) {
    console.error(`✗ ${style}: source not found at ${input}`)
    failed++
    continue
  }

  try {
    execSync(`node ${CLI} compile ${input}${locale ? ` --locale ${locale}` : ''} -o ${output}`, {
      cwd: ROOT,
      stdio: 'inherit',
    })
  } catch {
    console.error(`✗ ${style}: compilation failed`)
    failed++
  }
}

console.log(`\nDone. ${STYLES.length - failed}/${STYLES.length} styles compiled.`)

if (failed > 0) {
  process.exit(1)
}
