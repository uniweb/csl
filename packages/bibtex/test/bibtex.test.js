import { describe, it, expect } from 'vitest'
import { parseBibtex, convertLatex } from '../src/index.js'
import { exportBibtex } from '../src/index.js'

// ── LaTeX conversion ────────────────────────────────────────────────────────

describe('convertLatex', () => {
  it('converts common accented characters', () => {
    expect(convertLatex('\\"a')).toBe('ä')
    expect(convertLatex("\\'e")).toBe('é')
    expect(convertLatex('\\`o')).toBe('ò')
    expect(convertLatex('\\^u')).toBe('û')
    expect(convertLatex('\\~n')).toBe('ñ')
  })

  it('converts braced accent forms', () => {
    expect(convertLatex('\\"{a}')).toBe('ä')
    expect(convertLatex("\\'{e}")).toBe('é')
    expect(convertLatex('\\v{c}')).toBe('č')
    expect(convertLatex('\\c{c}')).toBe('ç')
    expect(convertLatex('\\H{o}')).toBe('ő')
  })

  it('converts named commands', () => {
    expect(convertLatex('\\ss')).toBe('ß')
    expect(convertLatex('\\o')).toBe('ø')
    expect(convertLatex('\\ae')).toBe('æ')
    expect(convertLatex('\\l')).toBe('ł')
    expect(convertLatex('\\aa')).toBe('å')
  })

  it('handles symbol escapes', () => {
    expect(convertLatex('\\&')).toBe('&')
    expect(convertLatex('\\%')).toBe('%')
    expect(convertLatex('\\#')).toBe('#')
    expect(convertLatex('\\_')).toBe('_')
  })

  it('removes braces from protected text', () => {
    expect(convertLatex('{DNA}')).toBe('DNA')
    expect(convertLatex('A study of {DNA} in the {USA}')).toBe('A study of DNA in the USA')
  })

  it('strips formatting commands', () => {
    expect(convertLatex('\\emph{important}')).toBe('important')
    expect(convertLatex('\\textit{italic}')).toBe('italic')
    expect(convertLatex('\\textbf{bold}')).toBe('bold')
  })

  it('converts tilde to non-breaking space', () => {
    expect(convertLatex('J.~Smith')).toBe('J.\u00A0Smith')
  })

  it('handles empty/null input', () => {
    expect(convertLatex('')).toBe('')
    expect(convertLatex(null)).toBe(null)
  })
})

// ── BibTeX parsing ──────────────────────────────────────────────────────────

describe('parseBibtex', () => {
  it('parses a simple article entry', () => {
    const bib = `@article{smith2024,
      author = {Smith, John and Jones, Jane},
      title = {A Study of Citations},
      journal = {Journal of Examples},
      year = {2024},
      volume = {12},
      number = {3},
      pages = {45--67},
      doi = {10.1234/example}
    }`
    const items = parseBibtex(bib)
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.id).toBe('smith2024')
    expect(item.type).toBe('article-journal')
    expect(item.title).toBe('A Study of Citations')
    expect(item['container-title']).toBe('Journal of Examples')
    expect(item.volume).toBe('12')
    expect(item.issue).toBe('3')
    expect(item.page).toBe('45–67')
    expect(item.DOI).toBe('10.1234/example')
    expect(item.issued).toEqual({ 'date-parts': [[2024]] })
    expect(item.author).toHaveLength(2)
    expect(item.author[0]).toEqual({ family: 'Smith', given: 'John' })
    expect(item.author[1]).toEqual({ family: 'Jones', given: 'Jane' })
  })

  it('parses a book entry', () => {
    const bib = `@book{knuth1997,
      author = {Knuth, Donald E.},
      title = {The Art of Computer Programming},
      publisher = {Addison-Wesley},
      year = {1997},
      edition = {3rd},
      address = {Reading, MA}
    }`
    const items = parseBibtex(bib)
    expect(items[0].type).toBe('book')
    expect(items[0].publisher).toBe('Addison-Wesley')
    expect(items[0].edition).toBe('3rd')
    expect(items[0]['publisher-place']).toBe('Reading, MA')
  })

  it('parses inproceedings', () => {
    const bib = `@inproceedings{doe2023,
      author = {Doe, Jane},
      title = {Machine Learning in Practice},
      booktitle = {Proceedings of ICML 2023},
      year = {2023},
      pages = {100--110}
    }`
    const items = parseBibtex(bib)
    expect(items[0].type).toBe('paper-conference')
    expect(items[0]['container-title']).toBe('Proceedings of ICML 2023')
  })

  it('parses thesis types with genre', () => {
    const phd = `@phdthesis{lee2022,
      author = {Lee, Alice},
      title = {Novel Approaches},
      school = {MIT},
      year = {2022}
    }`
    const items = parseBibtex(phd)
    expect(items[0].type).toBe('thesis')
    expect(items[0].genre).toBe('PhD thesis')
    expect(items[0].publisher).toBe('MIT')
  })

  it('handles @string abbreviations', () => {
    const bib = `@string{jex = {Journal of Examples}}
    @article{smith2024,
      author = {Smith, John},
      title = {Test},
      journal = jex,
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0]['container-title']).toBe('Journal of Examples')
  })

  it('handles # concatenation', () => {
    const bib = `@string{j = {Journal}}
    @article{test,
      title = {A} # { Study},
      journal = j # { of Examples},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].title).toBe('A Study')
    expect(items[0]['container-title']).toBe('Journal of Examples')
  })

  it('handles quoted string values', () => {
    const bib = `@article{test,
      title = "A Study of Citations",
      year = "2024"
    }`
    const items = parseBibtex(bib)
    expect(items[0].title).toBe('A Study of Citations')
  })

  it('handles month abbreviations', () => {
    const bib = `@article{test,
      title = {Test},
      year = {2024},
      month = mar
    }`
    const items = parseBibtex(bib)
    expect(items[0].issued).toEqual({ 'date-parts': [[2024, 3]] })
  })

  it('handles numeric month values', () => {
    const bib = `@article{test,
      title = {Test},
      year = {2024},
      month = {6}
    }`
    const items = parseBibtex(bib)
    expect(items[0].issued).toEqual({ 'date-parts': [[2024, 6]] })
  })

  it('converts LaTeX accents in fields', () => {
    const bib = `@article{muller2024,
      author = {M\\"{u}ller, Hans},
      title = {Die Stra\\ss{}e nach Berlin},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].author[0].family).toBe('Müller')
    expect(items[0].title).toBe('Die Straße nach Berlin')
  })

  it('handles protected text in braces', () => {
    const bib = `@article{test,
      title = {A Study of {DNA} and {RNA}},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].title).toBe('A Study of DNA and RNA')
  })

  it('parses multiple entries', () => {
    const bib = `@article{a, title={First}, year={2024}}
    @book{b, title={Second}, year={2023}}
    @misc{c, title={Third}, year={2022}}`
    const items = parseBibtex(bib)
    expect(items).toHaveLength(3)
    expect(items[0].type).toBe('article-journal')
    expect(items[1].type).toBe('book')
    expect(items[2].type).toBe('article')
  })

  it('skips @comment and @preamble', () => {
    const bib = `@comment{This is a comment}
    @preamble{"Some preamble"}
    @article{test, title={Real Entry}, year={2024}}`
    const items = parseBibtex(bib)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Real Entry')
  })

  it('handles corporate authors in braces', () => {
    const bib = `@article{who2024,
      author = {{World Health Organization}},
      title = {Health Report},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].author[0]).toEqual({ literal: 'World Health Organization' })
  })

  it('handles name particles (von, de)', () => {
    const bib = `@article{beethoven,
      author = {van Beethoven, Ludwig},
      title = {Symphony},
      year = {1800}
    }`
    const items = parseBibtex(bib)
    expect(items[0].author[0]).toEqual({
      family: 'Beethoven',
      given: 'Ludwig',
      'non-dropping-particle': 'van',
    })
  })

  it('handles name suffixes (Jr., III)', () => {
    const bib = `@article{king,
      author = {King, Jr., Martin Luther},
      title = {Letter},
      year = {1963}
    }`
    const items = parseBibtex(bib)
    expect(items[0].author[0]).toEqual({
      family: 'King',
      given: 'Martin Luther',
      suffix: 'Jr.',
    })
  })

  it('handles empty input', () => {
    expect(parseBibtex('')).toEqual([])
    expect(parseBibtex(null)).toEqual([])
  })

  it('handles howpublished URL', () => {
    const bib = `@misc{web,
      title = {A Website},
      howpublished = {https://example.com},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].URL).toBe('https://example.com')
  })

  it('handles nested braces', () => {
    const bib = `@article{test,
      title = {Outer {Inner {Deep} text} end},
      year = {2024}
    }`
    const items = parseBibtex(bib)
    expect(items[0].title).toBe('Outer Inner Deep text end')
  })

  it('parses entries with parentheses delimiters', () => {
    const bib = `@article(smith2024,
      title = {Parentheses},
      year = {2024}
    )`
    const items = parseBibtex(bib)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Parentheses')
  })
})

// ── BibTeX serialization ────────────────────────────────────────────────────

describe('exportBibtex', () => {
  it('serializes a basic article', () => {
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
    const bib = exportBibtex(items)
    expect(bib).toContain('@article{smith2024,')
    expect(bib).toContain('author = {Smith, John}')
    expect(bib).toContain('title = {A Study}')
    expect(bib).toContain('journal = {Journal of Examples}')
    expect(bib).toContain('year = {2024}')
    expect(bib).toContain('month = mar')
    expect(bib).toContain('pages = {45--67}')
    expect(bib).toContain('doi = {10.1234/example}')
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
    const bib = exportBibtex(items)
    expect(bib).toContain('author = {Smith, John and Jones, Jane}')
  })

  it('serializes corporate authors', () => {
    const items = [{
      id: 'who',
      type: 'article-journal',
      author: [{ literal: 'World Health Organization' }],
    }]
    const bib = exportBibtex(items)
    expect(bib).toContain('author = {{World Health Organization}}')
  })

  it('serializes thesis with genre', () => {
    const items = [{
      id: 'thesis',
      type: 'thesis',
      genre: "Master's thesis",
      title: 'My Thesis',
    }]
    const bib = exportBibtex(items)
    expect(bib).toContain('@mastersthesis{thesis,')
  })

  it('serializes name particles', () => {
    const items = [{
      id: 'test',
      type: 'article-journal',
      author: [{ family: 'Beethoven', given: 'Ludwig', 'non-dropping-particle': 'van' }],
    }]
    const bib = exportBibtex(items)
    expect(bib).toContain('author = {van Beethoven, Ludwig}')
  })

  it('handles empty input', () => {
    expect(exportBibtex([])).toBe('')
    expect(exportBibtex(null)).toBe('')
  })
})

// ── Round-trip tests ────────────────────────────────────────────────────────

describe('BibTeX round-trip', () => {
  it('preserves core fields through parse → export → parse', () => {
    const original = `@article{smith2024,
      author = {Smith, John and Jones, Jane},
      title = {A Study of Citations},
      journal = {Journal of Examples},
      year = {2024},
      volume = {12},
      number = {3},
      pages = {45--67},
      doi = {10.1234/example}
    }`
    const items1 = parseBibtex(original)
    const exported = exportBibtex(items1)
    const items2 = parseBibtex(exported)

    expect(items2[0].title).toBe(items1[0].title)
    expect(items2[0]['container-title']).toBe(items1[0]['container-title'])
    expect(items2[0].volume).toBe(items1[0].volume)
    expect(items2[0].issue).toBe(items1[0].issue)
    expect(items2[0].page).toBe(items1[0].page)
    expect(items2[0].DOI).toBe(items1[0].DOI)
    expect(items2[0].author).toEqual(items1[0].author)
  })
})
