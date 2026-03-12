import { describe, it, expect } from 'vitest'
import { escapeHtml, stripFormatting, toHtml } from '../src/html.js'

describe('escapeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#x27;s')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello, World')).toBe('Hello, World')
    expect(escapeHtml('No special chars here')).toBe('No special chars here')
  })
})

describe('stripFormatting', () => {
  it('strips font formatting tokens', () => {
    // italic: U+E000/E001
    expect(stripFormatting('\uE000italic\uE001')).toBe('italic')
    // bold: U+E002/E003
    expect(stripFormatting('\uE002bold\uE003')).toBe('bold')
    // small-caps: U+E004/E005
    expect(stripFormatting('\uE004sc\uE005')).toBe('sc')
  })

  it('strips semantic span tokens', () => {
    // Semantic: \uE020className\uE021 content \uE022
    expect(stripFormatting('\uE020title\uE021My Book\uE022')).toBe('My Book')
  })

  it('strips nested font + semantic tokens', () => {
    const input = '\uE020container-title\uE021\uE000Nature\uE001\uE022'
    expect(stripFormatting(input)).toBe('Nature')
  })
})

describe('toHtml', () => {
  it('converts italic tokens to <i> tags', () => {
    expect(toHtml('\uE000italic\uE001')).toBe('<i>italic</i>')
  })

  it('converts bold tokens to <b> tags', () => {
    expect(toHtml('\uE002bold\uE003')).toBe('<b>bold</b>')
  })

  it('converts small-caps tokens to CSS-classed spans', () => {
    expect(toHtml('\uE004SC\uE005')).toBe('<span class="csl-sc">SC</span>')
  })

  it('converts semantic tokens to CSS-classed spans', () => {
    expect(toHtml('\uE020title\uE021My Book\uE022'))
      .toBe('<span class="csl-title">My Book</span>')
  })

  it('handles semantic + italic nesting', () => {
    const input = '\uE020container-title\uE021\uE000Nature\uE001\uE022'
    expect(toHtml(input))
      .toBe('<span class="csl-container-title"><i>Nature</i></span>')
  })

  it('auto-links DOIs inside semantic spans', () => {
    const input = '\uE020DOI\uE021https://doi.org/10.1234/test\uE022'
    const html = toHtml(input)
    expect(html).toContain('<a class="csl-doi"')
    expect(html).toContain('<span class="csl-DOI">')
    expect(html).toContain('</span>')
  })

  it('auto-links URLs inside semantic spans', () => {
    const input = '\uE020URL\uE021https://example.com/page\uE022'
    const html = toHtml(input)
    expect(html).toContain('<a class="csl-url"')
    expect(html).toContain('<span class="csl-URL">')
  })

  it('escapes HTML entities in content', () => {
    expect(toHtml('\uE020title\uE021A < B & C\uE022'))
      .toBe('<span class="csl-title">A &lt; B &amp; C</span>')
  })

  it('auto-links bare DOIs with doi: prefix', () => {
    const input = '\uE020DOI\uE021doi:10.1038/nn.2024\uE022'
    const html = toHtml(input)
    expect(html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
    expect(html).toContain('10.1038/nn.2024</a>')
  })

  it('auto-links bare DOIs with doi: space prefix', () => {
    const html = toHtml('doi: 10.1038/nn.2024')
    expect(html).toContain('<a class="csl-doi" href="https://doi.org/10.1038/nn.2024">')
  })

  it('does not double-link DOIs', () => {
    const input = 'https://doi.org/10.1038/nn.2024'
    const html = toHtml(input)
    // Should have exactly one <a> tag
    const matches = html.match(/<a /g)
    expect(matches).toHaveLength(1)
  })
})
