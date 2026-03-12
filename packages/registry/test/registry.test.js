import { describe, it, expect, beforeAll } from 'vitest'
import { createRegistry } from '../src/registry.js'
import { compile } from '../../compiler/src/compile.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')
const corePath = join(__dirname, '..', '..', 'core', 'src', 'index.js')
const tmpDir = join(__dirname, '..', '..', '..', 'test', '.tmp')

async function compileStyle(cslXml) {
  const { code } = compile(cslXml)
  const adjusted = code.replace("'@citestyle/core'", `'${corePath}'`)
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `reg-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, adjusted)
  return import(tmpFile)
}

// ── Test items ──────────────────────────────────────────────────────────────

const smith2024 = {
  id: 'smith2024',
  type: 'article-journal',
  title: 'First article',
  author: [{ family: 'Smith', given: 'John' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature',
  volume: '1',
}

const smith2024b = {
  id: 'smith2024b',
  type: 'article-journal',
  title: 'Second article',
  author: [{ family: 'Smith', given: 'John' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Science',
  volume: '2',
}

const jones2023 = {
  id: 'jones2023',
  type: 'book',
  title: 'A great book',
  author: [{ family: 'Jones', given: 'Jane' }],
  issued: { 'date-parts': [[2023]] },
  publisher: 'MIT Press',
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('createRegistry', () => {
  it('throws if no valid style provided', () => {
    expect(() => createRegistry(null)).toThrow()
    expect(() => createRegistry({})).toThrow()
  })

  it('creates a registry with basic API', () => {
    const registry = createRegistry({ bibliography: () => ({}), citation: () => ({}) })
    expect(registry.addItems).toBeTypeOf('function')
    expect(registry.getItem).toBeTypeOf('function')
    expect(registry.cite).toBeTypeOf('function')
    expect(registry.getBibliography).toBeTypeOf('function')
  })
})

describe('Registry with APA style', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    style = await compileStyle(csl)
  })

  it('adds items and assigns citation numbers', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    expect(reg.size).toBe(2)
    expect(smith2024['citation-number']).toBe(1)
    expect(jones2023['citation-number']).toBe(2)
  })

  it('getItem retrieves by ID', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024])
    expect(reg.getItem('smith2024')).toBe(smith2024)
    expect(reg.getItem('nonexistent')).toBeUndefined()
  })

  it('cite() formats author-date citations', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    const cit = reg.cite([{ id: 'smith2024' }])
    expect(cit.text).toContain('Smith')
    expect(cit.text).toContain('2024')
  })

  it('cite() handles multiple cites', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    const cit = reg.cite([{ id: 'smith2024' }, { id: 'jones2023' }])
    expect(cit.text).toContain('Smith')
    expect(cit.text).toContain('Jones')
  })

  it('cite() passes locator data through', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024])
    const cit = reg.cite([{ id: 'smith2024', locator: '42', label: 'page' }])
    expect(cit.text).toContain('42')
  })

  it('getBibliography() returns formatted entries', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    const bib = reg.getBibliography()
    expect(bib).toHaveLength(2)
    expect(bib[0].text).toBeTruthy()
    expect(bib[0].html).toBeTruthy()
    expect(bib[0].parts).toBeTruthy()
    expect(bib[0].links).toBeTruthy()
  })

  it('getBibliography() sorts entries', () => {
    const reg = createRegistry(style)
    // Add in non-alphabetical order
    reg.addItems([smith2024, jones2023])
    const bib = reg.getBibliography()
    // APA sorts alphabetically by author — Jones before Smith
    expect(bib[0].text).toContain('Jones')
    expect(bib[1].text).toContain('Smith')
  })
})

describe('Registry with IEEE style (numeric)', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'ieee.csl'), 'utf-8')
    style = await compileStyle(csl)
  })

  it('generates numeric citations', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    const cit1 = reg.cite([{ id: 'smith2024' }])
    expect(cit1.text).toBe('[1]')
    const cit2 = reg.cite([{ id: 'jones2023' }])
    expect(cit2.text).toBe('[2]')
  })

  it('assigns stable citation numbers', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, jones2023])
    // Citation numbers should be based on insertion order
    expect(smith2024['citation-number']).toBe(1)
    expect(jones2023['citation-number']).toBe(2)
  })
})

describe('subsequent-author-substitute', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'mla.csl'), 'utf-8')
    style = await compileStyle(csl)
  })

  it('replaces repeated author with substitute string', () => {
    const reg = createRegistry(style)
    reg.addItems([smith2024, smith2024b, jones2023])
    const bib = reg.getBibliography()
    // MLA uses "———" (3 em-dashes) for repeated authors
    // The second Smith entry should have the substitute
    // Find entries in sort order (by author, then title)
    const smithEntries = bib.filter(e => e.text.includes('Smith') || e.text.includes('\u2014'))
    if (smithEntries.length >= 2) {
      // Second entry by same author should have em-dashes
      expect(smithEntries[1].text).toContain('\u2014')
    }
  })
})

describe('year-suffix disambiguation', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    style = await compileStyle(csl)
  })

  it('assigns year-suffix when two items share author+year', () => {
    // Use fresh copies to avoid cross-test pollution
    const item1 = { ...smith2024, id: 'ys-smith2024a' }
    const item2 = { ...smith2024b, id: 'ys-smith2024b' }
    const reg = createRegistry(style)
    reg.addItems([item1, item2])

    const bib = reg.getBibliography()
    // APA year-suffix: Smith (2024a), Smith (2024b)
    expect(item1['year-suffix']).toBe('a')
    expect(item2['year-suffix']).toBe('b')
  })

  it('includes year-suffix in bibliography text', () => {
    const item1 = { ...smith2024, id: 'ys2-smith2024a' }
    const item2 = { ...smith2024b, id: 'ys2-smith2024b' }
    const reg = createRegistry(style)
    reg.addItems([item1, item2])

    const bib = reg.getBibliography()
    // Bibliography entries should include the suffix
    const texts = bib.map(e => e.text)
    expect(texts.some(t => t.includes('2024a'))).toBe(true)
    expect(texts.some(t => t.includes('2024b'))).toBe(true)
  })

  it('includes year-suffix in citations', () => {
    const item1 = { ...smith2024, id: 'ys3-smith2024a' }
    const item2 = { ...smith2024b, id: 'ys3-smith2024b' }
    const reg = createRegistry(style)
    reg.addItems([item1, item2])

    // Need to trigger year-suffix assignment
    reg.getBibliography()

    const cit1 = reg.cite([{ id: 'ys3-smith2024a' }])
    const cit2 = reg.cite([{ id: 'ys3-smith2024b' }])
    expect(cit1.text).toContain('2024a')
    expect(cit2.text).toContain('2024b')
  })

  it('does not assign suffix when items have different years', () => {
    const item1 = { ...smith2024, id: 'ys4-smith2024' }
    const item2 = { ...jones2023, id: 'ys4-jones2023' }
    const reg = createRegistry(style)
    reg.addItems([item1, item2])

    reg.getBibliography()
    expect(item1['year-suffix']).toBeUndefined()
    expect(item2['year-suffix']).toBeUndefined()
  })

  it('does not assign suffix when items have different authors', () => {
    const item1 = { ...smith2024, id: 'ys5-smith2024' }
    const item2 = {
      ...smith2024b, id: 'ys5-other2024',
      author: [{ family: 'Other', given: 'Person' }],
    }
    const reg = createRegistry(style)
    reg.addItems([item1, item2])

    reg.getBibliography()
    expect(item1['year-suffix']).toBeUndefined()
    expect(item2['year-suffix']).toBeUndefined()
  })
})
