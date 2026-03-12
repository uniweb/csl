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
    // Container title gets semantic span + italic wrapping
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
    expect(bib.html).toContain('csl-container-title')
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

  it('adds semantic CSS classes for each variable', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.html).toContain('class="csl-author"')
    expect(bib.html).toContain('class="csl-issued"')
    expect(bib.html).toContain('class="csl-title"')
    expect(bib.html).toContain('class="csl-container-title"')
    expect(bib.html).toContain('class="csl-volume"')
    expect(bib.html).toContain('class="csl-issue"')
    expect(bib.html).toContain('class="csl-page"')
    expect(bib.html).toContain('class="csl-DOI"')
  })

  it('semantic spans do not appear in text output', () => {
    const bib = apaStyle.bibliography(article)
    expect(bib.text).not.toMatch(/csl-/)
    expect(bib.text).not.toMatch(/[\uE020-\uE022]/)
  })
})

// ── Harvard (Cite Them Right 12th edition) ──────────────────────────────────

describe('Harvard - Cite Them Right 12th edition', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'harvard.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Harvard', () => {
    expect(
      style.meta.title.includes('Harvard') || style.meta.title.includes('Cite Them Right')
    ).toBe(true)
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toBe(
      'Smith, J. A. and Jones, B. C. (2024) \u201cNeural correlates of consciousness\u201d, Nature Neuroscience, 27(3), pp. 45-67. Available at: https://doi.org/10.1038/nn.2024.'
    )
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toBe(
      'Norman, D. A. (2013) The design of everyday things. 2nd ed. New York: Basic Books.'
    )
  })

  it('generates author-date citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(Smith and Jones, 2024)')
  })

  it('renders italic container title and semantic spans in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
    expect(bib.html).toMatch(/^<div class="csl-entry">/)
    expect(bib.html).toContain('class="csl-container-title"')
  })

  it('auto-links DOI in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
  })
})

// ── AMA (American Medical Association 11th edition) ─────────────────────────

describe('AMA 11th edition', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'ama.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles AMA', () => {
    expect(style.meta.title).toContain('AMA')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toBe(
      '1. Smith JA, Jones BC. Neural correlates of consciousness. Nature Neuroscience. 2024;27(3):45\u201367. doi:10.1038/nn.2024'
    )
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman DA')
    expect(bib.text).toContain('Design of Everyday Things')
    expect(bib.text).toContain('2nd ed')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('2013')
  })

  it('uses no-space initials (JA not J. A.)', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith JA')
    expect(bib.text).toContain('Jones BC')
    expect(bib.text).not.toContain('J. A.')
  })

  it('generates numeric citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('1')
  })

  it('renders italic container title in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
    expect(bib.html).toContain('class="csl-container-title"')
  })
})

// ── Nature ──────────────────────────────────────────────────────────────────

describe('Nature', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'nature.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Nature', () => {
    expect(style.meta.title).toBe('Nature')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toBe(
      '1. Smith, J. A. & Jones, B. C. Neural correlates of consciousness. Nature Neuroscience 27, 45-67 (2024).'
    )
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, D. A.')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('New York')
    expect(bib.text).toContain('2013')
  })

  it('generates numeric citations (superscript in HTML)', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('1')
    expect(cit.html).toMatch(/<sup>/)
  })

  it('renders italic container title and semantic spans in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
    expect(bib.html).toContain('class="csl-entry"')
  })
})

// ── Science ─────────────────────────────────────────────────────────────────

describe('Science', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'science.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Science', () => {
    expect(style.meta.title).toBe('Science')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toBe(
      '1. J. A. Smith, B. C. Jones, Neural correlates of consciousness. Nature Neuroscience 27, 45-67 (2024).'
    )
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('D. A. Norman')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('New York')
    expect(bib.text).toContain('ed. 2')
    expect(bib.text).toContain('2013')
  })

  it('generates numeric citations in parens', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(1)')
  })

  it('renders italic container title in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
    expect(bib.html).toMatch(/^<div class="csl-entry">/)
  })
})

// ── ACS (American Chemical Society) ─────────────────────────────────────────

describe('ACS', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'acs.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles ACS', () => {
    expect(style.meta.title).toContain('ACS')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith, J. A.; Jones, B. C.')
    expect(bib.text).toContain('Neural Correlates of Consciousness')
    expect(bib.text).toContain('Nature Neuroscience 2024')
    expect(bib.text).toContain('27 (3)')
    expect(bib.text).toContain('45\u201367')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, D. A.')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('New York')
    expect(bib.text).toContain('2013')
  })

  it('generates numeric superscript citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('1')
    expect(cit.html).toMatch(/<sup>/)
  })

  it('renders italic container title and semantic spans in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
    expect(bib.html).toContain('class="csl-container-title"')
  })

  it('uses semicolon-separated author names', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toMatch(/Smith, J\. A\.; Jones, B\. C\./)
  })
})

// ── Chicago Note-Bibliography ────────────────────────────────────────────────

describe('Chicago Notes-Bibliography 16th edition', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'chicago-note-bibliography.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Chicago Notes', () => {
    expect(style.meta.title).toContain('Chicago')
    expect(style.meta.class).toBe('note')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith, John Andrew')
    expect(bib.text).toContain('Jones')
    expect(bib.text).toContain('Neural Correlates of Consciousness')
    expect(bib.html).toContain('<i>Nature Neuroscience</i>')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, Donald Arthur')
    expect(bib.text).toContain('Design of Everyday Things')
    expect(bib.text).toContain('Basic Books')
    expect(bib.text).toContain('2013')
  })

  it('generates note-style citations (full reference in note)', () => {
    const cit = style.citation([{ item: article }])
    // Note style: citation is a full reference, not just (Author Year)
    expect(cit.text).toContain('Smith')
    expect(cit.text).toContain('Neural Correlates of Consciousness')
    expect(cit.text).toContain('Nature Neuroscience')
  })

  it('formats chapter with editor', () => {
    const bib = style.bibliography(chapter)
    expect(bib.text).toContain('LeCun')
    expect(bib.text).toContain('Deep Learning Fundamentals')
    expect(bib.text).toContain('MIT Press')
  })

  it('renders semantic CSS classes in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('class="csl-entry"')
    expect(bib.html).toContain('class="csl-author"')
    expect(bib.html).toContain('class="csl-title"')
  })
})

// ── Springer Basic (Author-Date) ────────────────────────────────────────────

describe('Springer Basic (author-date)', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'springer-basic-author-date.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Springer Basic', () => {
    expect(style.meta.title).toContain('Springer')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith JA')
    expect(bib.text).toContain('Jones BC')
    expect(bib.text).toContain('(2024)')
    expect(bib.text).toContain('Neural correlates of consciousness')
    expect(bib.text).toContain('Nature Neuroscience')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman DA')
    expect(bib.text).toContain('(2013)')
    expect(bib.text).toContain('design of everyday things')
    expect(bib.text).toContain('Basic Books')
  })

  it('generates author-date citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(Smith and Jones 2024)')
  })

  it('renders HTML with semantic spans', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('class="csl-entry"')
    expect(bib.html).toContain('class="csl-author"')
  })
})

// ── Elsevier Harvard ─────────────────────────────────────────────────────────

describe('Elsevier Harvard', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'elsevier-harvard.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Elsevier Harvard', () => {
    expect(style.meta.title).toContain('Elsevier')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith, J. A.')
    expect(bib.text).toContain('Jones, B. C.')
    expect(bib.text).toContain('2024')
    expect(bib.text).toContain('Neural correlates of consciousness')
    expect(bib.text).toContain('Nature Neuroscience')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, D. A.')
    expect(bib.text).toContain('2013')
    expect(bib.text).toContain('design of everyday things')
    expect(bib.text).toContain('Basic Books')
  })

  it('generates author-date citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('(Smith and Jones, 2024)')
  })

  it('auto-links DOI in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
  })
})

// ── ABNT (NBR 6023 — Brazilian standard) ─────────────────────────────────────

describe('ABNT (Associação Brasileira de Normas Técnicas)', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'abnt.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles ABNT', () => {
    expect(style.meta.title).toContain('Brasileira')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal with uppercase authors', () => {
    const bib = style.bibliography(article)
    // ABNT uses uppercase family names
    expect(bib.text).toContain('SMITH')
    expect(bib.text).toContain('JONES')
    expect(bib.text).toContain('Nature Neuroscience')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('NORMAN')
    expect(bib.text).toContain('design of everyday things')
    expect(bib.text).toContain('Basic Books')
  })

  it('generates in-text citations with semicolons', () => {
    const cit = style.citation([{ item: article }])
    // ABNT: (SMITH; JONES, 2024) — uppercase with semicolons
    expect(cit.text).toContain('Smith')
    expect(cit.text).toContain('2024')
  })

  it('uses pt-BR locale for labels', () => {
    const bib = style.bibliography(book)
    // ABNT uses Portuguese labels: "ed." for edition
    expect(bib.text).toContain('ed.')
  })

  it('renders semantic CSS classes', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('class="csl-entry"')
    expect(bib.html).toContain('class="csl-author"')
  })
})

// ── Cell ─────────────────────────────────────────────────────────────────────

describe('Cell', () => {
  let style

  beforeAll(async () => {
    const csl = readFileSync(join(fixturesDir, 'cell.csl'), 'utf-8')
    style = await compileAndEval(csl)
  })

  it('compiles Cell', () => {
    expect(style.meta.title).toBe('Cell')
    expect(style.meta.class).toBe('in-text')
  })

  it('formats article-journal bibliography', () => {
    const bib = style.bibliography(article)
    expect(bib.text).toContain('Smith, J. A.')
    expect(bib.text).toContain('Jones, B. C.')
    expect(bib.text).toContain('(2024)')
    expect(bib.text).toContain('Neural correlates of consciousness')
    expect(bib.text).toContain('Nature Neuroscience')
  })

  it('formats book bibliography', () => {
    const bib = style.bibliography(book)
    expect(bib.text).toContain('Norman, D. A.')
    expect(bib.text).toContain('(2013)')
    expect(bib.text).toContain('design of everyday things')
  })

  it('generates numeric citations', () => {
    const cit = style.citation([{ item: article }])
    expect(cit.text).toBe('1')
  })

  it('renders DOI link in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
  })

  it('renders italic container title in HTML', () => {
    const bib = style.bibliography(article)
    expect(bib.html).toContain('<i>')
    expect(bib.html).toContain('Nature Neuroscience')
  })
})
