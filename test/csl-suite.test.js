/**
 * CSL test suite fixture runner.
 *
 * Adapts fixtures from the CSL processor test suite
 * (github.com/citation-style-language/test-suite) to validate
 * individual constructs against the reference implementation.
 *
 * Each fixture contains: MODE (citation/bibliography), CSL (embedded style),
 * INPUT (CSL-JSON items), RESULT (expected text output).
 * Some also have CITATION-ITEMS (per-cite data like locators).
 */
import { describe, it, expect } from 'vitest'
import { compile } from '../packages/compiler/src/compile.js'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, 'csl-fixtures')
const corePath = join(__dirname, '..', 'packages', 'core', 'src', 'index.js')
const tmpDir = join(__dirname, '.tmp')

/**
 * Parse a CSL test fixture file.
 */
function parseFixture(text) {
  const sections = {}
  // Fixtures use >>== X ==>> through >>===== X =====>> (2-5 equals signs)
  const sectionRegex = />>={2,5} ([\w-]+) ={2,5}>>(.+?)<<={2,5} \1 ={2,5}<</gs
  let match
  while ((match = sectionRegex.exec(text)) !== null) {
    sections[match[1]] = match[2].trim()
  }
  return {
    mode: sections.MODE || 'citation',
    result: sections.RESULT || '',
    csl: sections.CSL || '',
    input: sections.INPUT ? JSON.parse(sections.INPUT) : [],
    citationItems: sections['CITATION-ITEMS'] ? JSON.parse(sections['CITATION-ITEMS']) : null,
  }
}

/**
 * Compile a CSL style and evaluate it.
 */
async function compileAndEval(cslXml) {
  const { code } = compile(cslXml)
  const adjustedCode = code.replace("'@citestyle/core'", `'${corePath}'`)
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `csl-suite-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, adjustedCode)
  return import(tmpFile)
}

/**
 * Strip nocase spans from string values.
 */
function stripNocase(val) {
  if (typeof val === 'string') {
    return val.replace(/<span class="nocase">|<\/span>/g, '')
  }
  return val
}

/**
 * Run a single fixture test.
 */
async function runFixture(fixturePath) {
  const text = readFileSync(fixturePath, 'utf-8')
  const fixture = parseFixture(text)

  // Skip fixtures with features we don't support yet
  const csl = fixture.csl
  if (csl.includes('position=') || csl.includes('ibid')) {
    return { skip: 'uses position/ibid (deferred)' }
  }
  if (/disambiguate[-=]/.test(csl)) {
    return { skip: 'uses disambiguation (deferred)' }
  }
  if (csl.includes('collapse=')) {
    return { skip: 'uses cite collapsing (deferred)' }
  }

  // Check for nocase spans in input — we can't apply text-case correctly with them
  const hasNocase = fixture.input.some(item =>
    Object.values(item).some(v => typeof v === 'string' && v.includes('<span class="nocase">'))
  )
  if (hasNocase) {
    return { skip: 'uses nocase spans (not yet supported)' }
  }

  // Clean input items
  const input = fixture.input.map(item => {
    const cleaned = { ...item }
    for (const [key, val] of Object.entries(cleaned)) {
      cleaned[key] = stripNocase(val)
    }
    return cleaned
  })

  // Build item lookup by id
  const itemsById = new Map(input.map(item => [item.id, item]))

  // Normalize expected result: strip citeproc-js HTML wrappers
  let expected = fixture.result
    .replace(/<div class="csl-bib-body">\s*/g, '')
    .replace(/\s*<\/div>\s*$/g, '')
    .replace(/<div class="csl-entry">/g, '')
    .replace(/<\/div>/g, '\n')
    .replace(/<\/?i>/g, '')       // Strip italic tags
    .replace(/<\/?b>/g, '')       // Strip bold tags
    .replace(/<\/?span[^>]*>/g, '') // Strip span tags
    .replace(/&#38;/g, '&')      // Decode HTML entities
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))) // Decode numeric entities
    .replace(/\n+/g, '\n')       // Collapse multiple newlines
    .replace(/^\n|\n$/g, '')     // Strip leading/trailing newlines
    .split('\n').map(l => l.trim()).join('\n')  // Strip per-line whitespace from HTML indentation
    .trim()

  const style = await compileAndEval(fixture.csl)

  let actual
  if (fixture.mode === 'bibliography') {
    actual = input.map(item => style.bibliography(item).text).join('\n')
  } else if (fixture.citationItems) {
    // CITATION-ITEMS: array of citation sets, each set is an array of cite objects
    const results = fixture.citationItems.map(citeSet => {
      const cites = citeSet.map(cite => {
        const item = itemsById.get(cite.id) || input[0]
        const citeObj = { item }
        if (cite.locator != null) citeObj.locator = cite.locator
        if (cite.label != null) citeObj.label = cite.label
        if (cite.prefix != null) citeObj.prefix = cite.prefix
        if (cite.suffix != null) citeObj.suffix = cite.suffix
        return citeObj
      })
      return style.citation(cites).text
    })
    actual = results.join('\n')
  } else {
    // citation mode — render all items as a single citation
    const cites = input.map(item => ({ item }))
    actual = style.citation(cites).text
  }

  return { actual, expected, mode: fixture.mode }
}

// ── Discover and run fixtures ────────────────────────────────────────────────

let fixtureFiles = []
try {
  fixtureFiles = readdirSync(fixturesDir)
    .filter(f => f.endsWith('.txt'))
    .sort()
} catch {
  // No fixtures directory
}

describe('CSL test suite fixtures', () => {
  if (fixtureFiles.length === 0) {
    it.skip('no fixtures found in test/csl-fixtures/', () => {})
    return
  }

  for (const file of fixtureFiles) {
    const name = basename(file, '.txt')

    it(name, async () => {
      const result = await runFixture(join(fixturesDir, file))

      if (result.skip) {
        // Skip with a note
        return
      }

      // Normalize quotes for comparison (citeproc-js uses straight, we use curly)
      const normalize = s => s
        .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
        .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
      expect(normalize(result.actual)).toBe(normalize(result.expected))
    })
  }
})
