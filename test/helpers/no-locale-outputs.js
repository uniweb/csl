#!/usr/bin/env node

/**
 * Digests of what every style formats with no locale passed: the record test/no-locale.test.js
 * holds the compiler to. Each style in test/fixtures, compiled with its own default and with each
 * --locale, over test/fixtures/corpus.json (bibliography text, html, parts and links; single cites;
 * cites with each locator label; a cluster; the sort order; formatAll; a registry run with
 * disambiguation and collapsing); and each CSL suite fixture, over its own input and the corpus.
 *
 * test/fixtures/no-locale-outputs.json is the record. After a change meant to alter some style's
 * output, write a new one:
 *
 *   node test/helpers/no-locale-outputs.js --write
 *
 * and say in the commit which outputs moved, and why.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DIR = join(__dirname, '..')
export const RECORD = join(TEST_DIR, 'fixtures', 'no-locale-outputs.json')
const LOCALES = [undefined, 'en-GB', 'de-DE', 'pt-BR', 'fr-FR']

/**
 * @param {string} [root] - the repository whose compiler, core and registry to run (this one)
 * @returns {Promise<Record<string, string>>}
 */
export async function outputDigests(root = join(TEST_DIR, '..')) {
  const { items: corpus, locators } = JSON.parse(readFileSync(join(TEST_DIR, 'fixtures', 'corpus.json'), 'utf8'))
  const { compile } = await import(pathToFileURL(join(root, 'packages/compiler/src/compile.js')).href)
  const { createRegistry } = await import(pathToFileURL(join(root, 'packages/registry/src/registry.js')).href)
  const { formatAll } = await import(pathToFileURL(join(root, 'packages/registry/src/format.js')).href)
  const corePath = join(root, 'packages/core/src/index.js')
  const tmp = join(TEST_DIR, '.tmp', `no-locale-${process.pid}-${Date.now()}`)
  mkdirSync(tmp, { recursive: true })

  const clone = (x) => JSON.parse(JSON.stringify(x))
  let n = 0
  const load = async (code) => {
    const file = join(tmp, `m${n++}.mjs`)
    writeFileSync(file, code.replace("'@citestyle/core'", `'${corePath}'`))
    return import(pathToFileURL(file).href)
  }
  const safe = (fn) => {
    try { return fn() } catch (e) { return 'THROW: ' + e.constructor.name + ': ' + e.message }
  }
  const exercise = (style) => {
    const out = {}
    if (style.bibliography) out.bib = corpus.map((it) => safe(() => style.bibliography(clone(it))))
    if (style.citation) {
      out.cite = corpus.map((it) => safe(() => style.citation([{ item: clone(it) }])))
      out.locators = locators.map((l) => safe(() => style.citation([{ item: clone(corpus[0]), ...l }])))
      out.cluster = safe(() => style.citation(corpus.slice(0, 6).map((it) => ({ item: clone(it) }))))
    }
    if (style.bibliographySort) out.sort = safe(() => clone(corpus).sort(style.bibliographySort).map((i) => i.id))
    out.formatAll = safe(() => formatAll(style, clone(corpus)).map((e) => e.text))
    out.registry = safe(() => {
      const reg = createRegistry(style)
      reg.addItems(clone(corpus))
      const r = { bib: reg.getBibliography() }
      if (style.citation) {
        r.cites = [
          reg.cite([{ id: 'smith2024a' }, { id: 'smith2024b' }, { id: 'smith2024c' }]),
          reg.cite([{ id: 'art1' }, { id: 'art2' }, { id: 'art3' }, { id: 'book1' }]),
          reg.cite([{ id: 'book1' }], { mode: 'suppress-author' }),
        ]
      }
      return r
    })
    return out
  }
  const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

  const digests = {}
  try {
    const stylesDir = join(TEST_DIR, 'fixtures')
    for (const file of readdirSync(stylesDir).filter((f) => f.endsWith('.csl')).sort()) {
      const xml = readFileSync(join(stylesDir, file), 'utf8')
      for (const locale of LOCALES) {
        const { code } = compile(xml, locale ? { locale } : {})
        digests[file + (locale ? ' --locale ' + locale : '')] = digest(exercise(await load(code)))
      }
    }
    const suiteDir = join(TEST_DIR, 'csl-fixtures')
    for (const file of readdirSync(suiteDir).filter((f) => f.endsWith('.txt')).sort()) {
      const text = readFileSync(join(suiteDir, file), 'utf8')
      const section = (name) => new RegExp(`>>={2,5} ${name} ={2,5}>>(.+?)<<={2,5} ${name} ={2,5}<<`, 's').exec(text)?.[1].trim()
      const input = JSON.parse(section('INPUT') || '[]')
      const style = await load(compile(section('CSL')).code)
      const own = style.bibliography
        ? input.map((it) => safe(() => style.bibliography(clone(it))))
        : safe(() => style.citation(clone(input).map((item) => ({ item }))))
      digests['fixture ' + file] = digest({ own, corpus: exercise(style) })
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return digests
}

// node test/helpers/no-locale-outputs.js [--root <repo>] --write [file]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const rootAt = args.indexOf('--root')
  const root = rootAt >= 0 ? resolve(args[rootAt + 1]) : undefined
  const digests = await outputDigests(root)
  if (args.includes('--write')) {
    writeFileSync(RECORD, JSON.stringify(digests, null, 2) + '\n')
    console.log(`${Object.keys(digests).length} digests → ${RECORD}`)
  } else {
    console.log(JSON.stringify(digests, null, 2))
  }
}
