import { describe, it, expect } from 'vitest'
import { parseRis, exportRis } from '../src/index.js'

// ── RIS parsing ─────────────────────────────────────────────────────────────

describe('parseRis', () => {
  it('parses a simple journal article', () => {
    const ris = `TY  - JOUR
AU  - Smith, John
AU  - Jones, Jane
TI  - A Study of Citations
JO  - Journal of Examples
VL  - 12
IS  - 3
SP  - 45
EP  - 67
PY  - 2024
DO  - 10.1234/example
ER  - `
    const items = parseRis(ris)
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.type).toBe('article-journal')
    expect(item.title).toBe('A Study of Citations')
    expect(item['container-title']).toBe('Journal of Examples')
    expect(item.volume).toBe('12')
    expect(item.issue).toBe('3')
    expect(item.page).toBe('45–67')
    expect(item.DOI).toBe('10.1234/example')
    expect(item.author).toHaveLength(2)
    expect(item.author[0]).toEqual({ family: 'Smith', given: 'John' })
    expect(item.author[1]).toEqual({ family: 'Jones', given: 'Jane' })
    expect(item.issued).toEqual({ 'date-parts': [[2024]] })
  })

  it('parses a book', () => {
    const ris = `TY  - BOOK
AU  - Knuth, Donald
TI  - The Art of Computer Programming
PB  - Addison-Wesley
CY  - Reading, MA
PY  - 1997
SN  - 978-0201896831
ER  - `
    const items = parseRis(ris)
    expect(items[0].type).toBe('book')
    expect(items[0].publisher).toBe('Addison-Wesley')
    expect(items[0]['publisher-place']).toBe('Reading, MA')
    expect(items[0].ISSN).toBe('978-0201896831')
  })

  it('parses a thesis', () => {
    const ris = `TY  - THES
AU  - Lee, Alice
TI  - Novel Approaches
PB  - MIT
PY  - 2022
ER  - `
    const items = parseRis(ris)
    expect(items[0].type).toBe('thesis')
    expect(items[0].publisher).toBe('MIT')
  })

  it('parses dates with year/month/day', () => {
    const ris = `TY  - JOUR
TI  - Test
PY  - 2024/03/15
ER  - `
    const items = parseRis(ris)
    expect(items[0].issued).toEqual({ 'date-parts': [[2024, 3, 15]] })
  })

  it('parses multiple records', () => {
    const ris = `TY  - JOUR
TI  - First
PY  - 2024
ER  -
TY  - BOOK
TI  - Second
PY  - 2023
ER  - `
    const items = parseRis(ris)
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('article-journal')
    expect(items[1].type).toBe('book')
  })

  it('handles keywords', () => {
    const ris = `TY  - JOUR
TI  - Test
KW  - machine learning
KW  - deep learning
KW  - AI
ER  - `
    const items = parseRis(ris)
    expect(items[0].keyword).toBe('machine learning, deep learning, AI')
  })

  it('handles abstract', () => {
    const ris = `TY  - JOUR
TI  - Test
AB  - This is the abstract of the paper.
ER  - `
    const items = parseRis(ris)
    expect(items[0].abstract).toBe('This is the abstract of the paper.')
  })

  it('handles editors', () => {
    const ris = `TY  - BOOK
TI  - Edited Volume
A2  - Editor, One
A2  - Editor, Two
ER  - `
    const items = parseRis(ris)
    expect(items[0].editor).toHaveLength(2)
    expect(items[0].editor[0]).toEqual({ family: 'Editor', given: 'One' })
  })

  it('handles conference papers', () => {
    const ris = `TY  - CONF
AU  - Doe, Jane
TI  - ML in Practice
T2  - ICML 2023
PY  - 2023
ER  - `
    const items = parseRis(ris)
    expect(items[0].type).toBe('paper-conference')
    expect(items[0]['container-title']).toBe('ICML 2023')
  })

  it('handles page start only', () => {
    const ris = `TY  - JOUR
TI  - Test
SP  - 42
ER  - `
    const items = parseRis(ris)
    expect(items[0].page).toBe('42')
  })

  it('handles empty/null input', () => {
    expect(parseRis('')).toEqual([])
    expect(parseRis(null)).toEqual([])
  })

  it('handles various type codes', () => {
    expect(parseRis('TY  - RPRT\nTI  - Test\nER  - ')[0].type).toBe('report')
    expect(parseRis('TY  - UNPB\nTI  - Test\nER  - ')[0].type).toBe('manuscript')
    expect(parseRis('TY  - MGZN\nTI  - Test\nER  - ')[0].type).toBe('article-magazine')
    expect(parseRis('TY  - NEWS\nTI  - Test\nER  - ')[0].type).toBe('article-newspaper')
    expect(parseRis('TY  - ELEC\nTI  - Test\nER  - ')[0].type).toBe('webpage')
  })

  it('uses ID tag for item id', () => {
    const ris = `TY  - JOUR
ID  - smith2024
TI  - Test
ER  - `
    const items = parseRis(ris)
    expect(items[0].id).toBe('smith2024')
  })

  it('handles collection-title via T3 tag', () => {
    const ris = `TY  - BOOK
TI  - Test
T3  - Lecture Notes in Computer Science
ER  - `
    const items = parseRis(ris)
    expect(items[0]['collection-title']).toBe('Lecture Notes in Computer Science')
  })
})

// ── RIS serialization ───────────────────────────────────────────────────────

describe('exportRis', () => {
  it('serializes a journal article', () => {
    const items = [{
      id: 'smith2024',
      type: 'article-journal',
      title: 'A Study',
      author: [{ family: 'Smith', given: 'John' }],
      'container-title': 'Journal of Examples',
      issued: { 'date-parts': [[2024, 3]] },
      volume: '12',
      issue: '3',
      page: '45–67',
      DOI: '10.1234/example',
    }]
    const ris = exportRis(items)
    expect(ris).toContain('TY  - JOUR')
    expect(ris).toContain('AU  - Smith, John')
    expect(ris).toContain('TI  - A Study')
    expect(ris).toContain('JO  - Journal of Examples')
    expect(ris).toContain('PY  - 2024/03')
    expect(ris).toContain('VL  - 12')
    expect(ris).toContain('IS  - 3')
    expect(ris).toContain('SP  - 45')
    expect(ris).toContain('EP  - 67')
    expect(ris).toContain('DO  - 10.1234/example')
    expect(ris).toContain('ER  - ')
  })

  it('serializes multiple authors', () => {
    const items = [{
      id: 'test',
      type: 'article-journal',
      author: [
        { family: 'Smith', given: 'John' },
        { family: 'Jones', given: 'Jane' },
      ],
    }]
    const ris = exportRis(items)
    expect(ris).toContain('AU  - Smith, John')
    expect(ris).toContain('AU  - Jones, Jane')
  })

  it('serializes a book', () => {
    const items = [{
      id: 'test',
      type: 'book',
      title: 'My Book',
      publisher: 'Publisher',
    }]
    const ris = exportRis(items)
    expect(ris).toContain('TY  - BOOK')
    expect(ris).toContain('PB  - Publisher')
  })

  it('uses T2 for non-journal container titles', () => {
    const items = [{
      id: 'test',
      type: 'paper-conference',
      'container-title': 'ICML 2023',
    }]
    const ris = exportRis(items)
    expect(ris).toContain('T2  - ICML 2023')
  })

  it('handles empty input', () => {
    expect(exportRis([])).toBe('')
    expect(exportRis(null)).toBe('')
  })
})

// ── Round-trip tests ────────────────────────────────────────────────────────

describe('RIS round-trip', () => {
  it('preserves core fields through parse → export → parse', () => {
    const original = `TY  - JOUR
AU  - Smith, John
AU  - Jones, Jane
TI  - A Study of Citations
JO  - Journal of Examples
VL  - 12
IS  - 3
SP  - 45
EP  - 67
PY  - 2024
DO  - 10.1234/example
ER  - `
    const items1 = parseRis(original)
    const exported = exportRis(items1)
    const items2 = parseRis(exported)

    expect(items2[0].title).toBe(items1[0].title)
    expect(items2[0]['container-title']).toBe(items1[0]['container-title'])
    expect(items2[0].volume).toBe(items1[0].volume)
    expect(items2[0].issue).toBe(items1[0].issue)
    expect(items2[0].DOI).toBe(items1[0].DOI)
    expect(items2[0].author).toEqual(items1[0].author)
  })
})
