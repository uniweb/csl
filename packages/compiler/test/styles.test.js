import { describe, it, expect, beforeAll } from 'vitest'
import { compile } from '../src/compile.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')

/**
 * Helper: compile a CSL string and evaluate the resulting module.
 */
async function compileAndEval(cslXml) {
  const { code } = compile(cslXml)
  const corePath = join(__dirname, '..', '..', 'core', 'src', 'index.js')
  const adjustedCode = code.replace("'@citestyle/core'", `'${corePath}'`)
  const tmpDir = join(__dirname, '..', '..', '..', 'test', '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `style-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, adjustedCode)
  return import(tmpFile)
}

// ── Test data ────────────────────────────────────────────────────────────────

const article = {
  type: 'article-journal',
  title: 'Neural correlates of consciousness',
  author: [
    { family: 'Smith', given: 'John Andrew' },
    { family: 'Jones', given: 'Barbara Carol' },
  ],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature Neuroscience',
  volume: '27',
  issue: '3',
  page: '45-67',
  DOI: '10.1038/nn.2024',
  'citation-number': '1',
}

const book = {
  type: 'book',
  title: 'The design of everyday things',
  author: [{ family: 'Norman', given: 'Donald Arthur' }],
  issued: { 'date-parts': [[2013]] },
  publisher: 'Basic Books',
  'publisher-place': 'New York',
  edition: '2',
  'citation-number': '2',
}

const chapter = {
  type: 'chapter',
  title: 'Deep learning fundamentals',
  author: [{ family: 'LeCun', given: 'Yann' }],
  editor: [{ family: 'Goodfellow', given: 'Ian' }],
  issued: { 'date-parts': [[2016]] },
  'container-title': 'Deep learning',
  publisher: 'MIT Press',
  page: '1-25',
  'citation-number': '3',
}

// ── MLA ──────────────────────────────────────────────────────────────────────

describe('MLA 9th edition', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'mla.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles MLA', () => {
    expect(style.meta.title).toContain('MLA')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal (full given names, title case, italic container)', () => {
    const bib = style.bibliography(article)
    // MLA uses full names, first author inverted
    expect(bib.text).toContain('Smith, John Andrew')
    expect(bib.text).toContain('and Barbara Carol Jones')
    // Title in quotes, title case
    expect(bib.text).toMatch(/\u201cNeural Correlates of Consciousness\u201d/)
    // Container title italic (check in HTML)
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
    // DOI as link
    expect(bib.html).toContain('<a class="csl-doi"')
  })

  it('formats book (italic title)', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, Donald Arthur')
    expect(bib.html).toContain('<i>The Design of Everyday Things</i>')
    expect(bib.text).toContain('Basic Books')
  })

  it('generates author-only citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(Smith and Jones)')
  })

  it('generates multi-source citations', () => {
    const cit = style.citation([{ item: article }, { item: book }])
    expect(cit.text).toContain('Smith and Jones')
    expect(cit.text).toContain('Norman')
  })
})

// ── Chicago Author-Date ──────────────────────────────────────────────────────

describe('Chicago Author-Date 18th edition', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'chicago-author-date.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Chicago', () => {
    expect(style.meta.title).toContain('Chicago')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal (year after author, quoted title)', () => {
    const bib = style.bibliography(article)
    // Chicago: Author. Year. "Title". Container Volume (Issue): Pages
    expect(bib.text).toMatch(/Smith.*2024/)
    expect(bib.text).toMatch(/\u201cNeural Correlates of Consciousness\u201d/)
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
    // Chicago-16 page range (no abbreviation for this range)
    expect(bib.text).toContain('45\u201367')
  })

  it('formats book', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, Donald Arthur')
    expect(bib.text).toContain('2013')
    expect(bib.html).toContain('<i>The Design of Everyday Things</i>')
  })

  it('generates (author year) citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(Smith and Jones 2024)')
  })

  it('generates multi-source citations', () => {
    const cit = style.citation([{ item: article }, { item: book }])
    expect(cit.text).toContain('Smith and Jones 2024')
    expect(cit.text).toContain('Norman 2013')
  })
})

// ── IEEE ─────────────────────────────────────────────────────────────────────

describe('IEEE', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'ieee.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles IEEE', () => {
    expect(style.meta.title).toContain('IEEE')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal (initials first, quotes, italic container)', () => {
    const bib = style.bibliography(article)
    // IEEE: initials before family, no inversion
    expect(bib.text).toContain('J. A. Smith')
    expect(bib.text).toContain('B. C. Jones')
    // Quoted title
    expect(bib.text).toMatch(/\u201cNeural correlates of consciousness\u201d/)
    // Italic container
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
  })

  it('formats book (italic title)', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('D. A. Norman')
    expect(bib.html).toContain('<i>The design of everyday things</i>')
    expect(bib.text).toContain('New York')
  })

  it('generates numeric citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('[1]')
  })

  it('generates multi-cite numeric citations', () => {
    const cit = style.citation([{ item: article }, { item: book }])
    expect(cit.text).toBe('[1], [2]')
  })
})

// ── Vancouver ────────────────────────────────────────────────────────────────

describe('Vancouver (Elsevier)', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'vancouver.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Vancouver', () => {
    expect(style.meta.title).toContain('Vancouver')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal (no-space initials, no quotes)', () => {
    const bib = style.bibliography(article)
    // Vancouver: Family + initials with no space/period
    expect(bib.text).toContain('Smith JA')
    expect(bib.text).toContain('Jones BC')
    // No title quotes or case changes
    expect(bib.text).toContain('Neural correlates of consciousness')
    // Semicolon date delimiter
    expect(bib.text).toMatch(/2024;27/)
  })

  it('formats book', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman DA')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('2nd ed')
  })

  it('generates numeric citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('[1]')
  })
})

// ── HTML output ──────────────────────────────────────────────────────────────

describe('HTML structured output', () => {
  let apaStyle

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    apaStyle = await compileAndEval(csl)
  })

  it('wraps bibliography in csl-entry div', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.html).toMatch(/^<div class="csl-entry">/)
    expect(bib.html).toMatch(/<\/div>$/)
  })

  it('wraps citation in csl-citation span', () => {
    const cit = apaStyle.citation([{ item: article }])
    expect(cit.html).toMatch(/^<span class="csl-citation">/)
    expect(cit.html).toMatch(/<\/span>$/)
  })

  it('escapes HTML entities in text content', () => {
    const itemWithHtml = {
      ...article,
      author: [{ family: 'O\'Brien', given: 'Jane' }],
      title: 'A < B & C > D',
    }
    const bib = apaStyle.bibliography(itemWithHtml)
    expect(bib.html).toContain('O&#x27;Brien')
    expect(bib.html).toContain('&lt; B &amp; C &gt;')
    // Text output should NOT be escaped
    expect(bib.text).toContain("O'Brien")
    expect(bib.text).toContain('A < B & C > D')
  })

  it('auto-links DOI URLs', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
    expect(bib.html).toContain('</a>')
  })

  it('applies italic formatting to container titles', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
  })

  it('strips formatting tokens from text output', () => {
    const bib = apaStyle.bibliography(article)
    // Text should have no PUA characters
    expect(bib.text).not.toMatch(/[\uE000-\uE007]/)
  })

  it('returns structured parts', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.parts.title).toBe('Neural correlates of consciousness')
    expect(bib.parts.doi).toBe('10.1038/nn.2024')
    expect(bib.parts.year).toBe('2024')
    expect(bib.parts.container).toBe('Nature Neuroscience')
    expect(bib.parts.volume).toBe('27')
    expect(bib.parts.issue).toBe('3')
  })

  it('returns extracted links', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.links.doi).toBe('https://doi.org/10.1038/nn.2024')
    expect(bib.links.url).toBeNull()
  })

  it('auto-links non-DOI URLs', () => {
    const webItem = {
      type: 'webpage',
      title: 'Test page',
      author: [{ family: 'Test', given: 'A' }],
      issued: { 'date-parts': [[2024]] },
      URL: 'https://example.com/page',
    }
    const bib = apaStyle.bibliography(webItem)
    expect(bib.html).toContain('<a class="csl-url" href="https://example.com/page">')
  })
})
