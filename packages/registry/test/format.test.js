import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { compile } from '../../compiler/src/compile.js'
import { format, formatAll, formatCitation } from '../src/format.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Compile APA style for testing
const apaXml = readFileSync(join(__dirname, '..', '..', '..', 'test', 'fixtures', 'apa.csl'), 'utf-8')
const { code: apaCode } = compile(apaXml)
const tmpFile = join(__dirname, '.apa-format-test.mjs')
import { writeFileSync } from 'fs'
writeFileSync(tmpFile, apaCode)
const apa = await import(tmpFile)

// Compile IEEE for numeric style testing
const ieeeXml = readFileSync(join(__dirname, '..', '..', '..', 'test', 'fixtures', 'ieee.csl'), 'utf-8')
const { code: ieeeCode } = compile(ieeeXml)
const ieeeTmpFile = join(__dirname, '.ieee-format-test.mjs')
writeFileSync(ieeeTmpFile, ieeeCode)
const ieee = await import(ieeeTmpFile)

import { rmSync } from 'fs'
import { afterAll } from 'vitest'
afterAll(() => {
  try { rmSync(tmpFile) } catch {}
  try { rmSync(ieeeTmpFile) } catch {}
})

const item1 = {
  id: 'smith2024',
  type: 'article-journal',
  title: 'A Study of Citations',
  author: [{ family: 'Smith', given: 'John A.' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Journal of Examples',
  volume: '12',
  issue: '3',
  page: '45-67',
  DOI: '10.1234/example',
}

const item2 = {
  id: 'jones2023',
  type: 'book',
  title: 'The Art of Testing',
  author: [{ family: 'Jones', given: 'Jane B.' }],
  issued: { 'date-parts': [[2023]] },
  publisher: 'Test Press',
}

const item3 = {
  id: 'lee2022',
  type: 'chapter',
  title: 'Chapter on Methods',
  author: [{ family: 'Lee', given: 'Alice' }],
  issued: { 'date-parts': [[2022]] },
  'container-title': 'Handbook of Research',
  editor: [{ family: 'Chen', given: 'Bob' }],
  publisher: 'Academic Press',
  page: '100-120',
}

// ── format() ────────────────────────────────────────────────────────────────

describe('format()', () => {
  it('formats a single bibliography entry', () => {
    const entry = format(apa, item1)
    expect(entry.text).toContain('Smith')
    expect(entry.text).toContain('2024')
    expect(entry.text).toContain('A Study of Citations')
    expect(entry.html).toContain('csl-entry')
    expect(entry.parts).toBeDefined()
    expect(entry.links).toBeDefined()
  })

  it('returns FormattedEntry shape', () => {
    const entry = format(apa, item1)
    expect(typeof entry.text).toBe('string')
    expect(typeof entry.html).toBe('string')
    expect(typeof entry.parts).toBe('object')
    expect(typeof entry.links).toBe('object')
  })

  it('formats different item types', () => {
    const bookEntry = format(apa, item2)
    expect(bookEntry.text).toContain('Jones')
    expect(bookEntry.text).toContain('The Art of Testing')

    const chapterEntry = format(apa, item3)
    expect(chapterEntry.text).toContain('Lee')
    expect(chapterEntry.text).toContain('Chapter on Methods')
  })

  it('throws for style without bibliography', () => {
    expect(() => format({ citation: () => {} }, item1)).toThrow('bibliography')
  })

  it('throws for null style', () => {
    expect(() => format(null, item1)).toThrow()
  })
})

// ── formatAll() ─────────────────────────────────────────────────────────────

describe('formatAll()', () => {
  it('formats multiple items', () => {
    const entries = formatAll(apa, [item1, item2, item3])
    expect(entries).toHaveLength(3)
    for (const entry of entries) {
      expect(entry.text).toBeTruthy()
      expect(entry.html).toBeTruthy()
    }
  })

  it('assigns citation numbers without mutating input', () => {
    const items = [{ ...item1 }, { ...item2 }, { ...item3 }]
    const entries = formatAll(ieee, items)
    // Output should reflect citation numbers (IEEE produces numbered refs)
    expect(entries.length).toBe(3)
    // Original items should NOT be mutated
    expect(items.every(i => i['citation-number'] == null)).toBe(true)
  })

  it('sorts items using bibliographySort', () => {
    // APA sorts alphabetically by author
    const items = [{ ...item3 }, { ...item1 }, { ...item2 }]
    const entries = formatAll(apa, items)
    expect(entries).toHaveLength(3)
    // All three items should be formatted
    const texts = entries.map(e => e.text)
    expect(texts.some(t => t.includes('Smith'))).toBe(true)
    expect(texts.some(t => t.includes('Jones'))).toBe(true)
    expect(texts.some(t => t.includes('Lee'))).toBe(true)
  })

  it('returns empty array for empty input', () => {
    expect(formatAll(apa, [])).toEqual([])
  })

  it('throws for style without bibliography', () => {
    expect(() => formatAll({ citation: () => {} }, [item1])).toThrow('bibliography')
  })
})

// ── formatCitation() ────────────────────────────────────────────────────────

describe('formatCitation()', () => {
  it('formats a simple citation', () => {
    const cite = formatCitation(apa, [{ item: item1 }])
    expect(cite.text).toContain('Smith')
    expect(cite.text).toContain('2024')
    expect(typeof cite.html).toBe('string')
  })

  it('formats multi-cite', () => {
    const cite = formatCitation(apa, [{ item: item1 }, { item: item2 }])
    expect(cite.text).toContain('Smith')
    expect(cite.text).toContain('Jones')
  })

  it('handles locators', () => {
    const cite = formatCitation(apa, [{ item: item1, locator: '42', label: 'page' }])
    expect(cite.text).toContain('42')
  })

  it('returns FormattedCitation shape', () => {
    const cite = formatCitation(apa, [{ item: item1 }])
    expect(typeof cite.text).toBe('string')
    expect(typeof cite.html).toBe('string')
  })

  it('throws for style without citation', () => {
    expect(() => formatCitation({ bibliography: () => {} }, [{ item: item1 }])).toThrow('citation')
  })
})
