import { describe, it, expect, beforeAll } from 'vitest'
import { createRegistry } from '../src/registry.js'
import { format, formatAll, formatCitation } from '../src/format.js'
import { compile } from '../../compiler/src/compile.js'
import { buildPacks } from '../../locales/generate.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')
const corePath = join(__dirname, '..', '..', 'core', 'src', 'index.js')
const tmpDir = join(__dirname, '..', '..', '..', 'test', '.tmp')
const { packs } = buildPacks()
const fr = packs.get('fr-FR')
const de = packs.get('de-DE')

async function compileStyle(file) {
  const { code } = compile(readFileSync(join(fixturesDir, file), 'utf-8'))
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `reg-locale-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, code.replace("'@citestyle/core'", `'${corePath}'`))
  return import(tmpFile)
}

const items = [
  {
    id: 'knuth', type: 'book', title: 'The art of computer programming', author: [{ family: 'Knuth', given: 'Donald' }],
    issued: { 'date-parts': [[1997]] }, publisher: 'Addison-Wesley', edition: '3',
  },
  {
    id: 'smith', type: 'article-journal', title: 'A study', author: [{ family: 'Smith', given: 'John' }, { family: 'Jones', given: 'Ann' }],
    issued: { 'date-parts': [[2024, 3]] }, 'container-title': 'Nature', volume: '1', page: '1-9',
  },
]
const clone = (x) => JSON.parse(JSON.stringify(x))

describe('a registry in a locale', () => {
  let mla
  beforeAll(async () => {
    mla = await compileStyle('mla.csl')
  })

  it('formats its bibliography and citations in the registry\'s locale', () => {
    const registry = createRegistry(mla, { locale: de })
    registry.addItems(clone(items))
    const texts = registry.getBibliography().map((e) => e.text)
    expect(texts[0]).toBe('Knuth, Donald. The Art of Computer Programming. 3. Aufl., Addison-Wesley, 1997.')
    expect(texts[1]).toContain('Smith, John, und Ann Jones. „A Study“. Nature, Bd. 1, März 2024, S. 1–9.')
    expect(registry.cite([{ id: 'smith' }]).text).toBe('(Smith und Jones)')
  })

  it('lets a call name another locale, or none', () => {
    const registry = createRegistry(mla, { locale: de })
    registry.addItems(clone(items))
    expect(registry.cite([{ id: 'smith' }], { locale: fr }).text).toBe('(Smith et Jones)')
    expect(registry.cite([{ id: 'smith' }], { locale: null }).text).toBe('(Smith and Jones)')
    expect(registry.getBibliography({ locale: fr })[0].text).toContain('3ᵉ éd.')
  })

  it('formats as before without a locale', () => {
    const plain = createRegistry(mla)
    plain.addItems(clone(items))
    const none = createRegistry(mla, { locale: undefined })
    none.addItems(clone(items))
    expect(none.getBibliography()).toEqual(plain.getBibliography())
    expect(none.cite([{ id: 'smith' }, { id: 'knuth' }])).toEqual(plain.cite([{ id: 'smith' }, { id: 'knuth' }]))
  })
})

describe('format helpers in a locale', () => {
  let apa
  beforeAll(async () => {
    apa = await compileStyle('apa.csl')
  })

  it('format, formatAll and formatCitation take { locale }', () => {
    expect(format(apa, clone(items[0]), { locale: fr }).text).toContain('(3ᵉ éd.)')
    expect(formatAll(apa, clone(items), { locale: de }).map((e) => e.text)[0]).toContain('(3. Aufl.)')
    expect(formatCitation(apa, [{ item: clone(items[1]), locator: '4', label: 'page' }], { locale: de }).text)
      .toBe('(Smith & Jones, 2024, Seite 4)')
  })
})
