import { describe, it, expect, beforeAll } from 'vitest'
import { compile } from '../src/compile.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')

/**
 * Helper: compile a CSL string and evaluate the resulting module.
 * Returns the module's exports (meta, bibliography, citation).
 */
async function compileAndEval(cslXml) {
  const { code } = compile(cslXml)
  // Replace the import to point to the local core package using absolute path
  const corePath = join(__dirname, '..', '..', 'core', 'src', 'index.js')
  const adjustedCode = code.replace(
    "'@citestyle/core'",
    `'${corePath}'`
  )
  // Write to a temp file and import
  const { writeFileSync, mkdirSync } = await import('node:fs')
  const tmpDir = join(__dirname, '..', '..', '..', 'test', '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.js`)
  writeFileSync(tmpFile, adjustedCode)
  return import(tmpFile)
}

const simpleStyle = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"
       initialize-with=". " names-delimiter=", ">
  <info>
    <title>Simple Test Style</title>
    <id>http://example.com/simple</id>
  </info>
  <macro name="author">
    <names variable="author">
      <name and="symbol" delimiter-precedes-last="always" name-as-sort-order="all"/>
    </names>
  </macro>
  <macro name="issued">
    <date variable="issued">
      <date-part name="year"/>
    </date>
  </macro>
  <citation>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
        <names variable="author">
          <name and="symbol" form="short"/>
        </names>
        <date variable="issued">
          <date-part name="year"/>
        </date>
      </group>
    </layout>
  </citation>
  <bibliography>
    <layout>
      <group delimiter=". ">
        <text macro="author"/>
        <text macro="issued" prefix="(" suffix=")"/>
        <text variable="title" font-style="italic"/>
      </group>
    </layout>
  </bibliography>
</style>`

describe('compile', () => {
  it('compiles a simple style and returns code + meta', () => {
    const { code, meta } = compile(simpleStyle)
    expect(meta.id).toBe('simple')
    expect(meta.title).toBe('Simple Test Style')
    expect(meta.class).toBe('in-text')
    expect(code).toContain('export function bibliography')
    expect(code).toContain('export function citation')
    expect(code).toContain('export const meta')
  })

  it('generates working bibliography function', async () => {
    const style = await compileAndEval(simpleStyle)
    const item = {
      type: 'article-journal',
      title: 'Test Article',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] },
    }
    const result = style.bibliography(item)
    expect(result.text).toContain('Smith, J.')
    expect(result.text).toContain('2024')
    expect(result.text).toContain('Test Article')
    expect(result).toHaveProperty('html')
    expect(result).toHaveProperty('parts')
    expect(result).toHaveProperty('links')
  })

  it('generates working citation function', async () => {
    const style = await compileAndEval(simpleStyle)
    const item = {
      type: 'article-journal',
      title: 'Test Article',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] },
    }
    const result = style.citation([{ item }])
    expect(result.text).toBe('(Smith, 2024)')
  })

  it('handles group suppression (empty variables)', async () => {
    const style = await compileAndEval(simpleStyle)
    const item = {
      type: 'article-journal',
      title: 'No Author Article',
      issued: { 'date-parts': [[2024]] },
    }
    const result = style.bibliography(item)
    // Should not have empty segments or dangling delimiters
    expect(result.text).not.toContain('. .')
    expect(result.text).toContain('2024')
  })

  it('handles multiple authors with et-al', async () => {
    const csl = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"
       initialize-with=". ">
  <info><title>Et Al Test</title><id>test</id></info>
  <bibliography et-al-min="3" et-al-use-first="1">
    <layout>
      <names variable="author">
        <name and="symbol" name-as-sort-order="all"/>
      </names>
    </layout>
  </bibliography>
</style>`
    const style = await compileAndEval(csl)
    const item = {
      type: 'article-journal',
      author: [
        { family: 'A', given: 'X' },
        { family: 'B', given: 'Y' },
        { family: 'C', given: 'Z' },
      ],
    }
    const result = style.bibliography(item)
    expect(result.text).toContain('A, X.')
    expect(result.text).toContain('et al.')
    expect(result.text).not.toContain('B')
  })
})

// CSL 1.0.2: "Substituted variables are suppressed in the rest of the output to prevent duplication."
// ⛔ They were not: an edited book printed its editors as its author and again as its editors, and an
// anonymous work printed its title twice.
describe('substitution', () => {
  const style = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Substitution Test</title><id>substitution</id></info>
  <locale>
    <terms>
      <term name="editor"></term>
      <term name="author">Author Term Value</term>
    </terms>
  </locale>
  <macro name="author">
    <names variable="author">
      <name/>
      <substitute>
        <names variable="editor"/>
        <text variable="title" font-style="italic"/>
      </substitute>
    </names>
  </macro>
  <citation>
    <layout delimiter="; ">
      <group delimiter=" ">
        <text value="by"/>
        <names variable="author">
          <name/>
          <substitute>
            <names variable="editor"/>
            <text variable="title" font-style="italic"/>
          </substitute>
        </names>
      </group>
      <text variable="title" quotes="true" prefix=", "/>
    </layout>
  </citation>
  <bibliography>
    <layout suffix=".">
      <group delimiter=". ">
        <text macro="author"/>
        <text variable="title"/>
        <names variable="editor">
          <label form="verb" suffix=" "/>
          <name/>
        </names>
        <group delimiter=" ">
          <text value="Title:"/>
          <text variable="title"/>
        </group>
        <group delimiter=" ">
          <text value="Content:"/>
          <names variable="translator">
            <substitute>
              <text term="editor"/>
              <text term="author"/>
            </substitute>
          </names>
        </group>
      </group>
    </layout>
  </bibliography>
</style>`
  const edited = { type: 'book', title: 'Edited volume', editor: [{ family: 'Smith', given: 'Jane' }] }
  const authored = { type: 'book', title: 'Authored book', author: [{ family: 'Doe', given: 'John' }], editor: [{ family: 'Smith', given: 'Jane' }] }
  const anonymous = { type: 'book', title: 'Anonymous book' }
  let s

  beforeAll(async () => {
    s = await compileAndEval(style)
  })

  it('prints the editors standing in for the author once', () => {
    expect(s.bibliography(edited).text).toBe('Jane Smith. Edited volume. Title: Edited volume. Content:.')
    expect(s.bibliography(authored).text).toBe('John Doe. Authored book. edited by Jane Smith. Title: Authored book. Content:.')
  })

  // A group with a term or a value and the substituted variable alone is left empty, so dropped
  it('prints a title standing in for the author once, and drops a group it leaves empty', () => {
    expect(s.bibliography(anonymous).text).toBe('Anonymous book. Content:.')
    expect(s.bibliography(anonymous).html).toBe('<div class="csl-entry"><span class="csl-title"><i>Anonymous book</i></span>. Content:.</div>')
  })

  it('suppresses within each cite of a citation, not across them', () => {
    expect(s.citation([{ item: anonymous }, { item: authored }]).text).toBe('by Anonymous book; by John Doe, “Authored book”')
  })

  // ⛔ A group dropped a <names> whose own variable was empty, even when its substitute rendered
  it('counts what a <names> substituted for the group around it', () => {
    expect(s.citation([{ item: edited }]).text).toBe('by Jane Smith, “Edited volume”')
  })

  // CSL test suite, substitute_SubstituteOnlyOnceTermEmpty: the empty "editor" term ends the
  // substitution, which counts for the group around it: "Content:", without the "author" term
  it('ends the substitution at a term the locale defines, even an empty one', () => {
    expect(s.bibliography(anonymous).text).toMatch(/Content:\.$/)
    expect(s.bibliography(anonymous).text).not.toContain('Author Term Value')
  })
})

describe('the style\'s notice', () => {
  it('opens a compiled module with the style\'s title, link, authors and rights, kept by minifiers', () => {
    const { code } = compile(readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8'))
    const notice = code.slice(0, code.indexOf('*/') + 2)
    expect(notice.startsWith('/*! APA Style 7th edition\n')).toBe(true)
    expect(notice).toContain(' * http://www.zotero.org/styles/apa\n')
    expect(notice).toContain(' * Authors: Brenton M. Wiernik <zotero@wiernik.org> https://orcid.org/0000-0001-9560-6336; Andrew Dunning')
    expect(notice).toContain(' * This work is licensed under a Creative Commons Attribution-ShareAlike 3.0 License (http://creativecommons.org/licenses/by-sa/3.0/)')
  })

  it('names the contributors too', () => {
    const { code } = compile(readFileSync(join(fixturesDir, 'nature.csl'), 'utf-8'))
    expect(code.slice(0, code.indexOf('*/'))).toMatch(/\n \* Contributors: \S/)
  })

  it('has none for a style whose <info> holds nothing to credit', () => {
    expect(compile(simpleStyle.replace(/<title>.*<\/title>/, '<title/>').replace(/<id>.*<\/id>/, '<id/>')).code.startsWith('// Generated')).toBe(true)
  })
})

describe('compile APA', () => {
  let style

  // Compile APA once for all tests
  it('compiles APA 7th edition', async () => {
    const apaCsl = readFileSync(join(fixturesDir, 'apa.csl'), 'utf-8')
    style = await compileAndEval(apaCsl)
    expect(style.meta.id).toBe('apa')
    expect(style.meta.title).toContain('APA')
  })

  it('formats article-journal correctly', () => {
    const item = {
      type: 'article-journal',
      title: 'A study of citation formatting',
      author: [
        { family: 'Smith', given: 'John Andrew' },
        { family: 'Jones', given: 'Barbara Carol' },
      ],
      issued: { 'date-parts': [[2024]] },
      'container-title': 'Journal of Examples',
      volume: '12',
      issue: '3',
      page: '45-67',
      DOI: '10.1234/example',
    }
    const bib = style.bibliography(item)
    expect(bib.text).toBe(
      'Smith, J. A., & Jones, B. C. (2024). A study of citation formatting. Journal of Examples, 12(3), 45\u201367. https://doi.org/10.1234/example'
    )

    const cit = style.citation([{ item }])
    expect(cit.text).toBe('(Smith & Jones, 2024)')
  })

  it('formats book correctly', () => {
    const item = {
      type: 'book',
      title: 'The art of computer programming',
      author: [{ family: 'Knuth', given: 'Donald Ervin' }],
      issued: { 'date-parts': [[1997]] },
      publisher: 'Addison-Wesley',
      edition: '3',
      volume: '1',
    }
    const bib = style.bibliography(item)
    expect(bib.text).toContain('Knuth, D. E.')
    expect(bib.text).toContain('(1997)')
    expect(bib.text).toContain('Addison-Wesley')
    expect(bib.text).toContain('3rd ed.')
    expect(bib.text).toContain('Vol. 1')
  })

  it('formats chapter correctly', () => {
    const item = {
      type: 'chapter',
      title: 'Memory management',
      author: [{ family: 'Garcia', given: 'Maria' }],
      editor: [{ family: 'Williams', given: 'Thomas' }],
      issued: { 'date-parts': [[2020]] },
      'container-title': 'Systems programming',
      publisher: 'Academic Press',
      page: '145-189',
      DOI: '10.1000/ch',
    }
    const bib = style.bibliography(item)
    expect(bib.text).toContain('Garcia, M.')
    expect(bib.text).toContain('In T. Williams')
    expect(bib.text).toContain('pp.')
    expect(bib.text).toContain('Academic Press')
  })

  it('returns structured parts', () => {
    const item = {
      type: 'article-journal',
      title: 'Test',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] },
      DOI: '10.1234/test',
      'container-title': 'Journal',
    }
    const bib = style.bibliography(item)
    expect(bib.parts.title).toBe('Test')
    expect(bib.parts.doi).toBe('10.1234/test')
    expect(bib.parts.year).toBe('2024')
    expect(bib.links.doi).toBe('https://doi.org/10.1234/test')
  })

  it('generates bibliographySort function', () => {
    expect(typeof style.bibliographySort).toBe('function')
  })
})
