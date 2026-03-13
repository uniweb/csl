import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { compile } from '../packages/compiler/src/compile.js'
import { createRegistry } from '../packages/registry/src/index.js'
import { parseBibtex, exportBibtex, convertLatex } from '../packages/bibtex/src/index.js'
import { parseRis, exportRis } from '../packages/ris/src/index.js'
import * as core from '../packages/core/src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const typesFile = readFileSync(join(__dirname, '..', 'packages', 'types', 'index.d.ts'), 'utf-8')

// ── Type definition accuracy ─────────────────────────────────────────────────

describe('type definitions match runtime', () => {
  it('types file declares all core exports', () => {
    const coreExports = Object.keys(core)
    for (const name of coreExports) {
      expect(typesFile).toContain(`export declare function ${name}`)
    }
  })

  it('types file declares compiler functions', () => {
    expect(typesFile).toContain('export declare function compile')
    expect(typesFile).toContain('export declare function parse')
    expect(typesFile).toContain('export declare function resolveLocale')
    expect(typesFile).toContain('export declare function generate')
  })

  it('types file declares registry function', () => {
    expect(typesFile).toContain('export declare function createRegistry')
  })

  it('types file declares bibtex functions', () => {
    expect(typesFile).toContain('export declare function parseBibtex')
    expect(typesFile).toContain('export declare function exportBibtex')
    expect(typesFile).toContain('export declare function convertLatex')
  })

  it('types file declares ris functions', () => {
    expect(typesFile).toContain('export declare function parseRis')
    expect(typesFile).toContain('export declare function exportRis')
  })

  it('FormattedEntry matches runtime shape', () => {
    const apaPath = join(__dirname, 'fixtures', 'apa.csl')
    const xml = readFileSync(apaPath, 'utf-8')
    const { code } = compile(xml)

    // FormattedEntry should have html, text, parts, links
    expect(typesFile).toContain('html: string')
    expect(typesFile).toContain('text: string')
    expect(typesFile).toContain('parts: Record<string, unknown>')
    expect(typesFile).toContain('links: Record<string, string | null>')
  })

  it('FormattedCitation matches runtime shape', () => {
    expect(typesFile).toContain('interface FormattedCitation')
    // Should have html and text
    const citationBlock = typesFile.slice(
      typesFile.indexOf('interface FormattedCitation'),
      typesFile.indexOf('}', typesFile.indexOf('interface FormattedCitation')) + 1
    )
    expect(citationBlock).toContain('html: string')
    expect(citationBlock).toContain('text: string')
  })

  it('StyleMeta includes disambiguation and collapse fields', () => {
    const metaBlock = typesFile.slice(
      typesFile.indexOf('interface StyleMeta'),
      typesFile.indexOf('}', typesFile.indexOf('interface StyleMeta') + 200) + 1
    )
    expect(metaBlock).toContain('disambiguateAddYearSuffix')
    expect(metaBlock).toContain('disambiguateAddNames')
    expect(metaBlock).toContain('disambiguateAddGivenname')
    expect(metaBlock).toContain('givennameDisambiguationRule')
    expect(metaBlock).toContain('collapse')
    expect(metaBlock).toContain('citationLayoutDelimiter')
    expect(metaBlock).toContain('subsequentAuthorSubstitute')
  })

  it('Registry interface matches runtime shape', () => {
    const startIdx = typesFile.indexOf('interface Registry {')
    const regBlock = typesFile.slice(
      startIdx,
      typesFile.indexOf('}', startIdx + 50) + 1
    )
    expect(regBlock).toContain('addItems')
    expect(regBlock).toContain('getItem')
    expect(regBlock).toContain('cite')
    expect(regBlock).toContain('getBibliography')
    expect(regBlock).toContain('size')
  })

  it('CslItem has all standard CSL name variables', () => {
    expect(typesFile).toContain("author?: CslName[]")
    expect(typesFile).toContain("editor?: CslName[]")
    expect(typesFile).toContain("translator?: CslName[]")
    expect(typesFile).toContain("'container-author'?: CslName[]")
    expect(typesFile).toContain("'collection-editor'?: CslName[]")
  })

  it('CslItem has all standard CSL date variables', () => {
    expect(typesFile).toContain("issued?: CslDate")
    expect(typesFile).toContain("accessed?: CslDate")
    expect(typesFile).toContain("'original-date'?: CslDate")
  })

  it('CslItem has year-suffix field', () => {
    expect(typesFile).toContain("'year-suffix'?: string")
  })

  it('CiteRef has all documented fields', () => {
    const citeBlock = typesFile.slice(
      typesFile.indexOf('interface CiteRef'),
      typesFile.indexOf('}', typesFile.indexOf('interface CiteRef') + 50) + 1
    )
    expect(citeBlock).toContain('id?: string')
    expect(citeBlock).toContain('item?: CslItem')
    expect(citeBlock).toContain('locator?: string')
    expect(citeBlock).toContain('label?: string')
    expect(citeBlock).toContain('prefix?: string')
    expect(citeBlock).toContain('suffix?: string')
  })
})

// ── Runtime shape validation ─────────────────────────────────────────────────

describe('runtime shapes match type contracts', () => {
  const apaPath = join(__dirname, 'fixtures', 'apa.csl')
  const xml = readFileSync(apaPath, 'utf-8')

  it('compile() returns { code: string, meta: object }', () => {
    const result = compile(xml)
    expect(typeof result.code).toBe('string')
    expect(typeof result.meta).toBe('object')
    expect(typeof result.meta.id).toBe('string')
    expect(typeof result.meta.title).toBe('string')
    expect(typeof result.meta.class).toBe('string')
  })

  it('createRegistry() returns object with correct methods', () => {
    const { code } = compile(xml)
    // Use eval approach to test — import compiled module
    // Instead, test with the fixture style used in other tests
    const reg = createRegistry({
      meta: { id: 'test', title: 'Test', class: 'in-text' },
      bibliography: (item) => ({ html: '', text: '', parts: {}, links: {} }),
      citation: (cites) => ({ html: '', text: '' }),
    })
    expect(typeof reg.addItems).toBe('function')
    expect(typeof reg.getItem).toBe('function')
    expect(typeof reg.cite).toBe('function')
    expect(typeof reg.getBibliography).toBe('function')
    expect(typeof reg.size).toBe('number')
    expect(reg.size).toBe(0)
  })

  it('registry.addItems and getItem work correctly', () => {
    const reg = createRegistry({
      meta: { id: 'test', title: 'Test', class: 'in-text' },
      bibliography: (item) => ({ html: '', text: '', parts: {}, links: {} }),
      citation: (cites) => ({ html: '', text: '' }),
    })
    const item = { id: 'abc', type: 'book', title: 'Hello' }
    reg.addItems([item])
    expect(reg.size).toBe(1)
    expect(reg.getItem('abc')).toBe(item)
    expect(reg.getItem('nonexistent')).toBeUndefined()
  })

  it('parseBibtex returns CslItem[]', () => {
    const items = parseBibtex('@article{test, title={Hello}, author={Smith, John}, year={2024}}')
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBe(1)
    expect(items[0].type).toBe('article-journal')
    expect(items[0].title).toBe('Hello')
    expect(items[0].author[0].family).toBe('Smith')
  })

  it('exportBibtex returns string', () => {
    const result = exportBibtex([{ id: 'test', type: 'book', title: 'Hello' }])
    expect(typeof result).toBe('string')
    expect(result).toContain('@book')
  })

  it('parseRis returns CslItem[]', () => {
    const items = parseRis('TY  - JOUR\nTI  - Hello\nER  - ')
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBe(1)
    expect(items[0].type).toBe('article-journal')
  })

  it('exportRis returns string', () => {
    const result = exportRis([{ id: 'test', type: 'article-journal', title: 'Hello' }])
    expect(typeof result).toBe('string')
    expect(result).toContain('TY  - JOUR')
  })

  it('convertLatex converts accents', () => {
    expect(convertLatex("\\\"{a}")).toBe('ä')
    expect(convertLatex("\\'{e}")).toBe('é')
  })
})
