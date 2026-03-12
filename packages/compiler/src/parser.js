/**
 * CSL XML Parser — transforms CSL XML into a typed AST.
 *
 * Uses @xmldom/xmldom for DOM parsing (build-time tool, parser weight irrelevant).
 * Walks the DOM into CSL-specific AST nodes.
 */
import { DOMParser } from '@xmldom/xmldom'

const CSL_NS = 'http://purl.org/net/xbiblio/csl'

/**
 * Parse a CSL XML string into a CSL AST.
 *
 * @param {string} xml - CSL XML source
 * @returns {CslStyleNode} Parsed AST
 */
export function parse(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const styleEl = doc.documentElement

  if (!styleEl || localName(styleEl) !== 'style') {
    throw new Error('Invalid CSL: root element must be <style>')
  }

  return parseStyle(styleEl)
}

/**
 * Parse the <style> root element.
 */
function parseStyle(el) {
  const node = {
    type: 'style',
    class: attr(el, 'class') || 'in-text',
    version: attr(el, 'version'),
    defaultLocale: attr(el, 'default-locale') || 'en-US',
    demoteNonDroppingParticle: attr(el, 'demote-non-dropping-particle') || 'display-and-sort',
    // Inheritable name options (global defaults)
    nameOptions: parseInheritableNameOptions(el),
    pageRangeFormat: attr(el, 'page-range-format'),
    info: null,
    localeOverrides: [],
    macros: {},
    citation: null,
    bibliography: null,
  }

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'info') {
      node.info = parseInfo(child)
    } else if (name === 'locale') {
      node.localeOverrides.push(parseLocaleOverride(child))
    } else if (name === 'macro') {
      const macroName = attr(child, 'name')
      node.macros[macroName] = {
        type: 'macro',
        name: macroName,
        children: parseRenderingElements(child),
      }
    } else if (name === 'citation') {
      node.citation = parseCitationOrBibliography(child, 'citation')
    } else if (name === 'bibliography') {
      node.bibliography = parseCitationOrBibliography(child, 'bibliography')
    }
  }

  return node
}

/**
 * Parse <info> element for metadata.
 */
function parseInfo(el) {
  const info = { title: '', titleShort: '', id: '', links: [], categories: [], rights: '' }
  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'title') info.title = textContent(child)
    else if (name === 'title-short') info.titleShort = textContent(child)
    else if (name === 'id') info.id = textContent(child)
    else if (name === 'rights') info.rights = textContent(child)
    else if (name === 'link') {
      info.links.push({ href: attr(child, 'href'), rel: attr(child, 'rel') })
    } else if (name === 'category') {
      const field = attr(child, 'field')
      const citFormat = attr(child, 'citation-format')
      if (field) info.categories.push(field)
      if (citFormat) info.citationFormat = citFormat
    }
  }
  return info
}

/**
 * Parse a locale override within the style.
 */
function parseLocaleOverride(el) {
  const override = {
    lang: attr(el, 'xml:lang') || attr(el, 'lang'),
    terms: {},
    dateFormats: {},
    styleOptions: {},
  }

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'terms') {
      for (const termEl of childElements(child)) {
        if (localName(termEl) === 'term') {
          const termName = attr(termEl, 'name')
          const form = attr(termEl, 'form') || 'long'
          const key = form === 'long' ? termName : termName + ':' + form

          // Check for single/multiple child elements
          const single = findChild(termEl, 'single')
          const multiple = findChild(termEl, 'multiple')
          if (single && multiple) {
            override.terms[key] = {
              single: textContent(single),
              multiple: textContent(multiple),
            }
          } else {
            override.terms[key] = textContent(termEl)
          }
        }
      }
    } else if (name === 'date') {
      const form = attr(child, 'form')
      override.dateFormats[form] = parseDateNode(child)
    } else if (name === 'style-options') {
      override.styleOptions = {
        punctuationInQuote: attr(child, 'punctuation-in-quote'),
      }
    }
  }

  return override
}

/**
 * Parse <citation> or <bibliography> element.
 */
function parseCitationOrBibliography(el, type) {
  const node = {
    type,
    nameOptions: parseInheritableNameOptions(el),
    sort: null,
    layout: null,
    // Bibliography-specific
    subsequentAuthorSubstitute: attr(el, 'subsequent-author-substitute'),
    secondFieldAlign: attr(el, 'second-field-align'),
    hangingIndent: attr(el, 'hanging-indent') === 'true',
    entrySpacing: attr(el, 'entry-spacing'),
    lineSpacing: attr(el, 'line-spacing'),
    // Citation-specific
    disambiguateAddYearSuffix: attr(el, 'disambiguate-add-year-suffix') === 'true',
    disambiguateAddNames: attr(el, 'disambiguate-add-names') === 'true',
    disambiguateAddGivenname: attr(el, 'disambiguate-add-givenname') === 'true',
    givennameDisambiguationRule: attr(el, 'givenname-disambiguation-rule'),
    collapseAttr: attr(el, 'collapse'),
    citeGroupDelimiter: attr(el, 'cite-group-delimiter'),
    yearSuffixDelimiter: attr(el, 'year-suffix-delimiter'),
    afterCollapseDelimiter: attr(el, 'after-collapse-delimiter'),
    nearNoteDistance: attr(el, 'near-note-distance'),
  }

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'sort') {
      node.sort = parseSort(child)
    } else if (name === 'layout') {
      node.layout = parseLayout(child)
    }
  }

  return node
}

/**
 * Parse <layout> element.
 */
function parseLayout(el) {
  return {
    type: 'layout',
    ...parseFormatting(el),
    delimiter: attr(el, 'delimiter'),
    verticalAlign: attr(el, 'vertical-align'),
    children: parseRenderingElements(el),
  }
}

/**
 * Parse <sort> element.
 */
function parseSort(el) {
  const keys = []
  for (const child of childElements(el)) {
    if (localName(child) === 'key') {
      keys.push({
        type: 'sort-key',
        variable: attr(child, 'variable'),
        macro: attr(child, 'macro'),
        sort: attr(child, 'sort') || 'ascending',
        namesMin: attr(child, 'names-min'),
        namesUseFirst: attr(child, 'names-use-first'),
        namesUseLast: attr(child, 'names-use-last'),
      })
    }
  }
  return { type: 'sort', keys }
}

/**
 * Parse all rendering elements within a parent.
 */
function parseRenderingElements(parent) {
  const children = []
  for (const el of childElements(parent)) {
    const node = parseRenderingElement(el)
    if (node) children.push(node)
  }
  return children
}

/**
 * Parse a single rendering element.
 */
function parseRenderingElement(el) {
  const name = localName(el)

  switch (name) {
    case 'text': return parseText(el)
    case 'number': return parseNumber(el)
    case 'label': return parseLabel(el)
    case 'group': return parseGroup(el)
    case 'choose': return parseChoose(el)
    case 'names': return parseNames(el)
    case 'date': return parseDateNode(el)
    default: return null
  }
}

/**
 * Parse <text> element.
 */
function parseText(el) {
  return {
    type: 'text',
    variable: attr(el, 'variable'),
    macro: attr(el, 'macro'),
    term: attr(el, 'term'),
    value: attr(el, 'value'),
    form: attr(el, 'form'),
    plural: attr(el, 'plural'),
    ...parseFormatting(el),
  }
}

/**
 * Parse <number> element.
 */
function parseNumber(el) {
  return {
    type: 'number',
    variable: attr(el, 'variable'),
    form: attr(el, 'form') || 'numeric',
    ...parseFormatting(el),
  }
}

/**
 * Parse <label> element.
 */
function parseLabel(el) {
  return {
    type: 'label',
    variable: attr(el, 'variable'),
    form: attr(el, 'form') || 'long',
    plural: attr(el, 'plural') || 'contextual',
    ...parseFormatting(el),
  }
}

/**
 * Parse <group> element.
 */
function parseGroup(el) {
  return {
    type: 'group',
    ...parseFormatting(el),
    delimiter: attr(el, 'delimiter'),
    children: parseRenderingElements(el),
  }
}

/**
 * Parse <choose> element.
 */
function parseChoose(el) {
  const conditions = []
  let elseNode = null

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'if' || name === 'else-if') {
      conditions.push({
        type: 'condition',
        match: attr(child, 'match') || 'all',
        tests: parseConditionTests(child),
        children: parseRenderingElements(child),
      })
    } else if (name === 'else') {
      elseNode = {
        type: 'else',
        children: parseRenderingElements(child),
      }
    }
  }

  return {
    type: 'choose',
    conditions,
    else: elseNode,
  }
}

/**
 * Parse condition tests from if/else-if attributes.
 */
function parseConditionTests(el) {
  const tests = []

  const typeAttr = attr(el, 'type')
  if (typeAttr) {
    tests.push({ test: 'type', values: typeAttr.split(/\s+/) })
  }

  const variableAttr = attr(el, 'variable')
  if (variableAttr) {
    tests.push({ test: 'variable', values: variableAttr.split(/\s+/) })
  }

  const isNumericAttr = attr(el, 'is-numeric')
  if (isNumericAttr) {
    tests.push({ test: 'is-numeric', values: isNumericAttr.split(/\s+/) })
  }

  const locatorAttr = attr(el, 'locator')
  if (locatorAttr) {
    tests.push({ test: 'locator', values: locatorAttr.split(/\s+/) })
  }

  const positionAttr = attr(el, 'position')
  if (positionAttr) {
    tests.push({ test: 'position', values: positionAttr.split(/\s+/) })
  }

  const disambiguateAttr = attr(el, 'disambiguate')
  if (disambiguateAttr) {
    tests.push({ test: 'disambiguate', values: [disambiguateAttr] })
  }

  const isUncertainDate = attr(el, 'is-uncertain-date')
  if (isUncertainDate) {
    tests.push({ test: 'is-uncertain-date', values: isUncertainDate.split(/\s+/) })
  }

  return tests
}

/**
 * Parse <names> element.
 */
function parseNames(el) {
  const node = {
    type: 'names',
    variables: (attr(el, 'variable') || '').split(/\s+/).filter(Boolean),
    ...parseFormatting(el),
    nameNode: null,
    etAlNode: null,
    labelNode: null,
    substitute: null,
  }

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'name') {
      node.nameNode = parseNameNode(child)
    } else if (name === 'et-al') {
      node.etAlNode = {
        type: 'et-al',
        term: attr(child, 'term') || 'et-al',
        ...parseFormatting(child),
      }
    } else if (name === 'label') {
      node.labelNode = parseLabel(child)
    } else if (name === 'substitute') {
      node.substitute = {
        type: 'substitute',
        children: parseRenderingElements(child),
      }
      // CSL spec: substitute <names> without children inherit from parent
      for (const sub of node.substitute.children) {
        if (sub.type === 'names' && !sub.nameNode) {
          sub.nameNode = node.nameNode
          if (!sub.etAlNode) sub.etAlNode = node.etAlNode
          if (!sub.labelNode) sub.labelNode = node.labelNode
        }
      }
    }
  }

  return node
}

/**
 * Parse <name> element.
 */
function parseNameNode(el) {
  const node = {
    type: 'name',
    and: attr(el, 'and'),
    delimiter: attr(el, 'delimiter') ?? ', ',
    delimiterPrecedesEtAl: attr(el, 'delimiter-precedes-et-al'),
    delimiterPrecedesLast: attr(el, 'delimiter-precedes-last'),
    etAlMin: attrInt(el, 'et-al-min'),
    etAlUseFirst: attrInt(el, 'et-al-use-first'),
    etAlUseLast: attr(el, 'et-al-use-last') === 'true',
    etAlSubsequentMin: attrInt(el, 'et-al-subsequent-min'),
    etAlSubsequentUseFirst: attrInt(el, 'et-al-subsequent-use-first'),
    form: attr(el, 'form') || 'long',
    initialize: attr(el, 'initialize') !== 'false',
    initializeWith: attr(el, 'initialize-with'),
    nameAsSortOrder: attr(el, 'name-as-sort-order'),
    sortSeparator: attr(el, 'sort-separator') ?? ', ',
    ...parseFormatting(el),
    nameParts: [],
  }

  for (const child of childElements(el)) {
    if (localName(child) === 'name-part') {
      node.nameParts.push({
        name: attr(child, 'name'),
        ...parseFormatting(child),
      })
    }
  }

  return node
}

/**
 * Parse <date> or locale <date> element.
 */
function parseDateNode(el) {
  const node = {
    type: 'date',
    variable: attr(el, 'variable'),
    form: attr(el, 'form'),
    datePartsAttr: attr(el, 'date-parts'),
    datePartsDelimiter: attr(el, 'delimiter'),
    ...parseFormatting(el),
    dateParts: [],
  }

  for (const child of childElements(el)) {
    if (localName(child) === 'date-part') {
      node.dateParts.push({
        type: 'date-part',
        name: attr(child, 'name'),
        form: attr(child, 'form'),
        rangeDelimiter: attr(child, 'range-delimiter'),
        ...parseFormatting(child),
      })
    }
  }

  return node
}

/**
 * Parse inheritable name options from style, citation, or bibliography elements.
 */
function parseInheritableNameOptions(el) {
  const opts = {}
  const mappings = {
    'names-delimiter': 'namesDelimiter',
    'name-form': 'form',
    'name-delimiter': 'delimiter',
    'initialize': 'initialize',
    'initialize-with': 'initializeWith',
    'name-as-sort-order': 'nameAsSortOrder',
    'sort-separator': 'sortSeparator',
    'and': 'and',
    'delimiter-precedes-last': 'delimiterPrecedesLast',
    'delimiter-precedes-et-al': 'delimiterPrecedesEtAl',
    'et-al-min': 'etAlMin',
    'et-al-use-first': 'etAlUseFirst',
    'et-al-use-last': 'etAlUseLast',
    'et-al-subsequent-min': 'etAlSubsequentMin',
    'et-al-subsequent-use-first': 'etAlSubsequentUseFirst',
  }

  for (const [xmlAttr, jsName] of Object.entries(mappings)) {
    const val = attr(el, xmlAttr)
    if (val != null) {
      if (xmlAttr.includes('min') || xmlAttr.includes('first')) {
        opts[jsName] = parseInt(val, 10)
      } else if (val === 'true') {
        opts[jsName] = true
      } else if (val === 'false') {
        opts[jsName] = false
      } else {
        opts[jsName] = val
      }
    }
  }

  return Object.keys(opts).length > 0 ? opts : null
}

/**
 * Parse formatting and affix attributes common to most elements.
 */
function parseFormatting(el) {
  const f = {}

  const fontStyle = attr(el, 'font-style')
  if (fontStyle) f.fontStyle = fontStyle

  const fontWeight = attr(el, 'font-weight')
  if (fontWeight) f.fontWeight = fontWeight

  const fontVariant = attr(el, 'font-variant')
  if (fontVariant) f.fontVariant = fontVariant

  const textDecoration = attr(el, 'text-decoration')
  if (textDecoration) f.textDecoration = textDecoration

  const textCase = attr(el, 'text-case')
  if (textCase) f.textCase = textCase

  const display = attr(el, 'display')
  if (display) f.display = display

  const quotes = attr(el, 'quotes')
  if (quotes) f.quotes = quotes === 'true'

  const stripPeriods = attr(el, 'strip-periods')
  if (stripPeriods) f.stripPeriods = stripPeriods === 'true'

  const prefix = attr(el, 'prefix')
  if (prefix != null) f.prefix = prefix

  const suffix = attr(el, 'suffix')
  if (suffix != null) f.suffix = suffix

  return f
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function localName(el) {
  return el.localName || el.nodeName?.replace(/^.*:/, '')
}

function attr(el, name) {
  if (!el.hasAttribute?.(name)) return null
  return el.getAttribute(name)
}

function attrInt(el, name) {
  const val = attr(el, name)
  return val != null ? parseInt(val, 10) : undefined
}

function textContent(el) {
  let text = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === 3 /* TEXT_NODE */ || child.nodeType === 4 /* CDATA */) {
      text += child.nodeValue || ''
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      text += textContent(child)
    }
  }
  return text.trim()
}

function childElements(el) {
  const result = []
  if (!el.childNodes) return result
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 1) {
      result.push(el.childNodes[i])
    }
  }
  return result
}

function findChild(el, name) {
  for (const child of childElements(el)) {
    if (localName(child) === name) return child
  }
  return null
}
