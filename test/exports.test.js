import { describe, it, expect } from 'vitest'

// ── @citestyle/core exports ──────────────────────────────────────────────────

describe('@citestyle/core exports', () => {
  it('exports all documented functions', async () => {
    const core = await import('../packages/core/src/index.js')
    expect(typeof core.formatNames).toBe('function')
    expect(typeof core.formatDate).toBe('function')
    expect(typeof core.titleCase).toBe('function')
    expect(typeof core.sentenceCase).toBe('function')
    expect(typeof core.capitalize).toBe('function')
    expect(typeof core.applyTextCase).toBe('function')
    expect(typeof core.stripNocaseSpans).toBe('function')
    expect(typeof core.ordinal).toBe('function')
    expect(typeof core.longOrdinal).toBe('function')
    expect(typeof core.roman).toBe('function')
    expect(typeof core.pageRange).toBe('function')
    expect(typeof core.escapeHtml).toBe('function')
    expect(typeof core.stripFormatting).toBe('function')
    expect(typeof core.toHtml).toBe('function')
  })

  it('has no unexpected exports', async () => {
    const core = await import('../packages/core/src/index.js')
    const expected = new Set([
      'formatNames', 'formatDate',
      'titleCase', 'sentenceCase', 'capitalize', 'applyTextCase', 'stripNocaseSpans',
      'ordinal', 'longOrdinal', 'roman',
      'pageRange',
      'escapeHtml', 'stripFormatting', 'toHtml',
    ])
    for (const key of Object.keys(core)) {
      expect(expected.has(key)).toBe(true)
    }
  })
})

// ── @citestyle/compiler exports ──────────────────────────────────────────────

describe('@citestyle/compiler exports', () => {
  it('exports compile, parse, resolveLocale, generate', async () => {
    const compiler = await import('../packages/compiler/src/index.js')
    expect(typeof compiler.compile).toBe('function')
    expect(typeof compiler.parse).toBe('function')
    expect(typeof compiler.resolveLocale).toBe('function')
    expect(typeof compiler.generate).toBe('function')
  })
})

// ── @citestyle/registry exports ──────────────────────────────────────────────

describe('@citestyle/registry exports', () => {
  it('exports createRegistry', async () => {
    const registry = await import('../packages/registry/src/index.js')
    expect(typeof registry.createRegistry).toBe('function')
  })
})

// ── @citestyle/bibtex exports ────────────────────────────────────────────────

describe('@citestyle/bibtex exports', () => {
  it('exports parseBibtex, convertLatex, exportBibtex', async () => {
    const bibtex = await import('../packages/bibtex/src/index.js')
    expect(typeof bibtex.parseBibtex).toBe('function')
    expect(typeof bibtex.convertLatex).toBe('function')
    expect(typeof bibtex.exportBibtex).toBe('function')
  })
})

// ── @citestyle/ris exports ───────────────────────────────────────────────────

describe('@citestyle/ris exports', () => {
  it('exports parseRis, exportRis', async () => {
    const ris = await import('../packages/ris/src/index.js')
    expect(typeof ris.parseRis).toBe('function')
    expect(typeof ris.exportRis).toBe('function')
  })
})
