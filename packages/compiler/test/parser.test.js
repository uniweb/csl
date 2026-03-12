import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'

const minimal = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info>
    <title>Test Style</title>
    <id>http://example.com/test</id>
  </info>
  <macro name="author">
    <names variable="author">
      <name and="symbol" name-as-sort-order="all"/>
    </names>
  </macro>
  <citation>
    <layout prefix="(" suffix=")" delimiter="; ">
      <text macro="author"/>
    </layout>
  </citation>
  <bibliography>
    <layout>
      <group delimiter=". ">
        <text macro="author"/>
        <text variable="title"/>
      </group>
    </layout>
  </bibliography>
</style>`

describe('parse', () => {
  it('parses style metadata', () => {
    const ast = parse(minimal)
    expect(ast.type).toBe('style')
    expect(ast.class).toBe('in-text')
    expect(ast.version).toBe('1.0')
  })

  it('parses info element', () => {
    const ast = parse(minimal)
    expect(ast.info.title).toBe('Test Style')
    expect(ast.info.id).toBe('http://example.com/test')
  })

  it('parses macros', () => {
    const ast = parse(minimal)
    expect(ast.macros).toHaveProperty('author')
    expect(ast.macros.author.children).toHaveLength(1)
    expect(ast.macros.author.children[0].type).toBe('names')
    expect(ast.macros.author.children[0].variables).toEqual(['author'])
  })

  it('parses names with name node', () => {
    const ast = parse(minimal)
    const namesNode = ast.macros.author.children[0]
    expect(namesNode.nameNode).toBeTruthy()
    expect(namesNode.nameNode.and).toBe('symbol')
    expect(namesNode.nameNode.nameAsSortOrder).toBe('all')
  })

  it('parses citation layout', () => {
    const ast = parse(minimal)
    expect(ast.citation).toBeTruthy()
    expect(ast.citation.layout.prefix).toBe('(')
    expect(ast.citation.layout.suffix).toBe(')')
    expect(ast.citation.layout.delimiter).toBe('; ')
    expect(ast.citation.layout.children).toHaveLength(1)
  })

  it('parses bibliography layout', () => {
    const ast = parse(minimal)
    expect(ast.bibliography).toBeTruthy()
    expect(ast.bibliography.layout.children).toHaveLength(1)
    const group = ast.bibliography.layout.children[0]
    expect(group.type).toBe('group')
    expect(group.delimiter).toBe('. ')
    expect(group.children).toHaveLength(2)
  })

  it('parses text elements', () => {
    const ast = parse(minimal)
    const group = ast.bibliography.layout.children[0]
    expect(group.children[0].type).toBe('text')
    expect(group.children[0].macro).toBe('author')
    expect(group.children[1].type).toBe('text')
    expect(group.children[1].variable).toBe('title')
  })

  it('parses choose/if/else', () => {
    const csl = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Test</title><id>test</id></info>
  <bibliography><layout>
    <choose>
      <if type="article-journal">
        <text variable="title"/>
      </if>
      <else-if variable="DOI">
        <text variable="DOI"/>
      </else-if>
      <else>
        <text value="unknown"/>
      </else>
    </choose>
  </layout></bibliography>
</style>`
    const ast = parse(csl)
    const choose = ast.bibliography.layout.children[0]
    expect(choose.type).toBe('choose')
    expect(choose.conditions).toHaveLength(2)
    expect(choose.conditions[0].tests[0]).toEqual({ test: 'type', values: ['article-journal'] })
    expect(choose.conditions[1].tests[0]).toEqual({ test: 'variable', values: ['DOI'] })
    expect(choose.else).toBeTruthy()
    expect(choose.else.children[0].value).toBe('unknown')
  })

  it('parses inheritable name options from style element', () => {
    const csl = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"
       initialize-with=". " names-delimiter=", " page-range-format="expanded">
  <info><title>Test</title><id>test</id></info>
  <bibliography><layout><text variable="title"/></layout></bibliography>
</style>`
    const ast = parse(csl)
    expect(ast.nameOptions).toEqual({
      initializeWith: '. ',
      namesDelimiter: ', ',
    })
    expect(ast.pageRangeFormat).toBe('expanded')
  })

  it('parses date elements', () => {
    const csl = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Test</title><id>test</id></info>
  <bibliography><layout>
    <date variable="issued" form="numeric" date-parts="year"/>
  </layout></bibliography>
</style>`
    const ast = parse(csl)
    const dateNode = ast.bibliography.layout.children[0]
    expect(dateNode.type).toBe('date')
    expect(dateNode.variable).toBe('issued')
    expect(dateNode.form).toBe('numeric')
    expect(dateNode.datePartsAttr).toBe('year')
  })

  it('parses substitute with name inheritance', () => {
    const csl = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Test</title><id>test</id></info>
  <bibliography><layout>
    <names variable="composer">
      <name and="symbol" name-as-sort-order="all"/>
      <substitute>
        <names variable="author"/>
      </substitute>
    </names>
  </layout></bibliography>
</style>`
    const ast = parse(csl)
    const names = ast.bibliography.layout.children[0]
    expect(names.substitute.children[0].type).toBe('names')
    // Author names should inherit the name node from parent
    expect(names.substitute.children[0].nameNode).toBeTruthy()
    expect(names.substitute.children[0].nameNode.and).toBe('symbol')
    expect(names.substitute.children[0].nameNode.nameAsSortOrder).toBe('all')
  })
})
