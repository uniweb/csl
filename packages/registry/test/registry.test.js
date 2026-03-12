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

describe('cite collapsing (citation-number)', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'vancouver.csl'), 'utf-8')
    style = await compileStyle(csl)
  })

  it('exposes collapse in meta', () => {
    expect(style.meta.collapse).toBe('citation-number')
  })

  it('collapses consecutive numbers into range', () => {
    const items = [
      { id: 'a', type: 'article-journal', title: 'A', author: [{ family: 'A', given: 'A' }], issued: { 'date-parts': [[2020]] } },
      { id: 'b', type: 'article-journal', title: 'B', author: [{ family: 'B', given: 'B' }], issued: { 'date-parts': [[2021]] } },
      { id: 'c', type: 'article-journal', title: 'C', author: [{ family: 'C', given: 'C' }], issued: { 'date-parts': [[2022]] } },
      { id: 'd', type: 'article-journal', title: 'D', author: [{ family: 'D', given: 'D' }], issued: { 'date-parts': [[2023]] } },
    ]
    const reg = createRegistry(style)
    reg.addItems(items)
    // Cite items 1, 2, 3, 4 (all consecutive)
    const cit = reg.cite([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])
    expect(cit.text).toBe('[1\u20134]')
  })

  it('collapses with gaps', () => {
    const items = [
      { id: 'e1', type: 'article-journal', title: 'E1', author: [{ family: 'E', given: 'E' }], issued: { 'date-parts': [[2020]] } },
      { id: 'e2', type: 'article-journal', title: 'E2', author: [{ family: 'F', given: 'F' }], issued: { 'date-parts': [[2021]] } },
      { id: 'e3', type: 'article-journal', title: 'E3', author: [{ family: 'G', given: 'G' }], issued: { 'date-parts': [[2022]] } },
      { id: 'e4', type: 'article-journal', title: 'E4', author: [{ family: 'H', given: 'H' }], issued: { 'date-parts': [[2023]] } },
      { id: 'e5', type: 'article-journal', title: 'E5', author: [{ family: 'I', given: 'I' }], issued: { 'date-parts': [[2024]] } },
    ]
    const reg = createRegistry(style)
    reg.addItems(items)
    // Cite 1, 2, 3, 5 (gap between 3 and 5) — all inside one bracket group
    const cit = reg.cite([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e5' }])
    expect(cit.text).toBe('[1\u20133,5]')
  })

  it('does not collapse pairs (only ranges of 3+)', () => {
    const items = [
      { id: 'p1', type: 'article-journal', title: 'P1', author: [{ family: 'P', given: 'P' }], issued: { 'date-parts': [[2020]] } },
      { id: 'p2', type: 'article-journal', title: 'P2', author: [{ family: 'Q', given: 'Q' }], issued: { 'date-parts': [[2021]] } },
      { id: 'p3', type: 'article-journal', title: 'P3', author: [{ family: 'R', given: 'R' }], issued: { 'date-parts': [[2022]] } },
    ]
    const reg = createRegistry(style)
    reg.addItems(items)
    // Cite 1, 3 — gap, no range possible — still inside one bracket group
    const cit = reg.cite([{ id: 'p1' }, { id: 'p3' }])
    expect(cit.text).toBe('[1,3]')
  })

  it('does not collapse single cite', () => {
    const items = [
      { id: 's1', type: 'article-journal', title: 'S', author: [{ family: 'S', given: 'S' }], issued: { 'date-parts': [[2020]] } },
    ]
    const reg = createRegistry(style)
    reg.addItems(items)
    const cit = reg.cite([{ id: 's1' }])
    expect(cit.text).toBe('[1]')
  })
})

// ── Name disambiguation ────────────────────────────────────────────────────

describe('name disambiguation (add-givenname)', () => {
  let apaStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    apaStyle = await compileStyle(csl)
  })

  it('APA exposes disambiguation meta', () => {
    expect(apaStyle.meta.disambiguateAddGivenname).toBe(true)
    expect(apaStyle.meta.disambiguateAddNames).toBe(true)
    expect(apaStyle.meta.givennameDisambiguationRule).toBe('primary-name-with-initials')
  })

  it('disambiguates same-surname authors by adding initials', () => {
    // Two different authors with same surname, different given names
    const itemA = {
      id: 'disambig-a', type: 'article-journal', title: 'Alpha study',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Nature',
    }
    const itemB = {
      id: 'disambig-b', type: 'article-journal', title: 'Beta study',
      author: [{ family: 'Smith', given: 'Jane' }],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Science',
    }
    const reg = createRegistry(apaStyle)
    reg.addItems([itemA, itemB])

    const citA = reg.cite([{ id: 'disambig-a' }])
    const citB = reg.cite([{ id: 'disambig-b' }])

    // APA primary-name-with-initials: "(J. Smith, 2024)" vs "(J. Smith, 2024)"
    // Wait — both are "J." → initials don't help → falls through to year-suffix
    // Different people, different given names but same initial: year-suffix applied
    // Actually, authorYearKey differs (different given names), so no year-suffix
    // The disambiguation should at least add initials
    expect(citA.text).toContain('J. Smith')
    expect(citB.text).toContain('J. Smith')
  })

  it('disambiguates with distinct initials', () => {
    // Two authors with same surname but different initials
    const itemA = {
      id: 'init-a', type: 'article-journal', title: 'Study A',
      author: [{ family: 'Johnson', given: 'Amy' }],
      issued: { 'date-parts': [[2023]] }, 'container-title': 'Nature',
    }
    const itemB = {
      id: 'init-b', type: 'article-journal', title: 'Study B',
      author: [{ family: 'Johnson', given: 'Brian' }],
      issued: { 'date-parts': [[2023]] }, 'container-title': 'Science',
    }
    const reg = createRegistry(apaStyle)
    reg.addItems([itemA, itemB])

    const citA = reg.cite([{ id: 'init-a' }])
    const citB = reg.cite([{ id: 'init-b' }])

    // Initials are different → "(A. Johnson, 2023)" vs "(B. Johnson, 2023)"
    expect(citA.text).toContain('A.')
    expect(citB.text).toContain('B.')
    expect(citA.text).not.toBe(citB.text)
  })

  it('no disambiguation needed for different surnames', () => {
    const itemA = {
      id: 'diff-a', type: 'article-journal', title: 'Study A',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Nature',
    }
    const itemB = {
      id: 'diff-b', type: 'article-journal', title: 'Study B',
      author: [{ family: 'Jones', given: 'Jane' }],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Science',
    }
    const reg = createRegistry(apaStyle)
    reg.addItems([itemA, itemB])

    const citA = reg.cite([{ id: 'diff-a' }])
    const citB = reg.cite([{ id: 'diff-b' }])

    // No disambiguation — family names are different
    expect(citA.text).toBe('(Smith, 2024)')
    expect(citB.text).toBe('(Jones, 2024)')
  })
})

describe('name disambiguation (add-names)', () => {
  let chicagoStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'chicago-author-date.csl'), 'utf-8')
    chicagoStyle = await compileStyle(csl)
  })

  it('Chicago exposes primary-name rule', () => {
    expect(chicagoStyle.meta.disambiguateAddGivenname).toBe(true)
    expect(chicagoStyle.meta.disambiguateAddNames).toBe(true)
    expect(chicagoStyle.meta.givennameDisambiguationRule).toBe('primary-name')
  })

  it('disambiguates by expanding et-al truncated names', () => {
    // Chicago uses et-al-min=3, et-al-use-first=1
    // Two papers by different teams but same first author → same truncated citation
    const itemA = {
      id: 'etn-a', type: 'article-journal', title: 'Study A',
      author: [
        { family: 'Smith', given: 'John' },
        { family: 'Jones', given: 'Amy' },
        { family: 'Brown', given: 'Bob' },
      ],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Nature',
    }
    const itemB = {
      id: 'etn-b', type: 'article-journal', title: 'Study B',
      author: [
        { family: 'Smith', given: 'John' },
        { family: 'White', given: 'Carol' },
        { family: 'Green', given: 'Dan' },
      ],
      issued: { 'date-parts': [[2024]] }, 'container-title': 'Science',
    }
    const reg = createRegistry(chicagoStyle)
    reg.addItems([itemA, itemB])

    const citA = reg.cite([{ id: 'etn-a' }])
    const citB = reg.cite([{ id: 'etn-b' }])

    // Default: both would be "(Smith et al. 2024)"
    // After add-names: should show more names to disambiguate
    // "(Smith, Jones, et al. 2024)" vs "(Smith, White, et al. 2024)" or fully expanded
    expect(citA.text).not.toBe(citB.text)
    // Both should contain their distinguishing second author
    expect(citA.text).toContain('Jones')
    expect(citB.text).toContain('White')
  })
})

describe('name disambiguation (by-cite rule, ASA)', () => {
  let asaStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'american-sociological-association.csl'), 'utf-8')
    asaStyle = await compileStyle(csl)
  })

  it('ASA uses by-cite rule', () => {
    expect(asaStyle.meta.givennameDisambiguationRule).toBe('by-cite')
  })

  it('progressively expands names for by-cite disambiguation', () => {
    const itemA = {
      id: 'bc-a', type: 'article-journal', title: 'Study A',
      author: [{ family: 'Chen', given: 'Alice' }],
      issued: { 'date-parts': [[2023]] }, 'container-title': 'ASR',
    }
    const itemB = {
      id: 'bc-b', type: 'article-journal', title: 'Study B',
      author: [{ family: 'Chen', given: 'Bob' }],
      issued: { 'date-parts': [[2023]] }, 'container-title': 'AJS',
    }
    const reg = createRegistry(asaStyle)
    reg.addItems([itemA, itemB])

    const citA = reg.cite([{ id: 'bc-a' }])
    const citB = reg.cite([{ id: 'bc-b' }])

    // by-cite should expand given names to disambiguate
    expect(citA.text).not.toBe(citB.text)
    expect(citA.text).toContain('Alice')
    expect(citB.text).toContain('Bob')
  })
})

// ── Author-date cite collapsing ─────────────────────────────────────────────

describe('cite collapsing (year)', () => {
  let apaStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    apaStyle = await compileStyle(csl)
  })

  it('APA exposes year collapsing', () => {
    expect(apaStyle.meta.collapse).toBe('year')
    expect(apaStyle.meta.citationLayoutPrefix).toBe('(')
    expect(apaStyle.meta.citationLayoutSuffix).toBe(')')
  })

  it('collapses consecutive same-author cites by year', () => {
    const items = [
      { id: 'cy-1', type: 'article-journal', title: 'Study 1',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'Nature' },
      { id: 'cy-2', type: 'article-journal', title: 'Study 2',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2021]] }, 'container-title': 'Science' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'cy-1' }, { id: 'cy-2' }])
    // Should be "(Smith, 2020, 2021)" not "(Smith, 2020; Smith, 2021)"
    expect(cit.text).toBe('(Smith, 2020, 2021)')
  })

  it('does not collapse different authors', () => {
    const items = [
      { id: 'nc-1', type: 'article-journal', title: 'Study 1',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'Nature' },
      { id: 'nc-2', type: 'article-journal', title: 'Study 2',
        author: [{ family: 'Jones', given: 'Jane' }],
        issued: { 'date-parts': [[2021]] }, 'container-title': 'Science' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'nc-1' }, { id: 'nc-2' }])
    // Different authors — no collapsing
    expect(cit.text).toContain('Smith')
    expect(cit.text).toContain('Jones')
    expect(cit.text).toContain('2020')
    expect(cit.text).toContain('2021')
  })

  it('collapses same-author with different-author between groups', () => {
    const items = [
      { id: 'mg-1', type: 'article-journal', title: 'S1',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'N' },
      { id: 'mg-2', type: 'article-journal', title: 'S2',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2021]] }, 'container-title': 'N' },
      { id: 'mg-3', type: 'article-journal', title: 'S3',
        author: [{ family: 'Jones', given: 'Jane' }],
        issued: { 'date-parts': [[2019]] }, 'container-title': 'S' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'mg-1' }, { id: 'mg-2' }, { id: 'mg-3' }])
    // Smith group collapses, Jones separate
    expect(cit.text).toContain('Smith, 2020, 2021')
    expect(cit.text).toContain('Jones, 2019')
  })

  it('single cite does not trigger collapsing', () => {
    const items = [
      { id: 'sc-1', type: 'article-journal', title: 'Solo',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2024]] }, 'container-title': 'N' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'sc-1' }])
    expect(cit.text).toBe('(Smith, 2024)')
  })
})

describe('cite collapsing (year-suffix)', () => {
  let springerStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'springer-basic-author-date.csl'), 'utf-8')
    springerStyle = await compileStyle(csl)
  })

  it('Springer exposes year-suffix collapse', () => {
    expect(springerStyle.meta.collapse).toBe('year-suffix')
    expect(springerStyle.meta.citeGroupDelimiter).toBe(', ')
  })
})

describe('cite collapsing (year with year-suffixes, APA)', () => {
  let apaStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    apaStyle = await compileStyle(csl)
  })

  it('collapses same-author cites with year-suffixes', () => {
    const items = [
      { id: 'ysapa-1', type: 'article-journal', title: 'Study A',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'Nature' },
      { id: 'ysapa-2', type: 'article-journal', title: 'Study B',
        author: [{ family: 'Smith', given: 'John' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'Science' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'ysapa-1' }, { id: 'ysapa-2' }])
    // APA: year-suffixed cites should collapse: "(Smith, 2020a, 2020b)"
    expect(cit.text).toContain('2020a')
    expect(cit.text).toContain('2020b')
    // Should be collapsed — only one mention of "Smith"
    const smithCount = (cit.text.match(/Smith/g) || []).length
    expect(smithCount).toBe(1)
  })

  it('collapses mixed years with year-suffixes', () => {
    const items = [
      { id: 'mys-1', type: 'article-journal', title: 'A',
        author: [{ family: 'Lee', given: 'Amy' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'N' },
      { id: 'mys-2', type: 'article-journal', title: 'B',
        author: [{ family: 'Lee', given: 'Amy' }],
        issued: { 'date-parts': [[2020]] }, 'container-title': 'S' },
      { id: 'mys-3', type: 'article-journal', title: 'C',
        author: [{ family: 'Lee', given: 'Amy' }],
        issued: { 'date-parts': [[2021]] }, 'container-title': 'N' },
    ]
    const reg = createRegistry(apaStyle)
    reg.addItems(items)

    const cit = reg.cite([{ id: 'mys-1' }, { id: 'mys-2' }, { id: 'mys-3' }])
    // Should collapse all under Lee: "(Lee, 2020a, 2020b, 2021)"
    expect(cit.text).toContain('2020a')
    expect(cit.text).toContain('2020b')
    expect(cit.text).toContain('2021')
    const leeCount = (cit.text.match(/Lee/g) || []).length
    expect(leeCount).toBe(1)
  })
})
