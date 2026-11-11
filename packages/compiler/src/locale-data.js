/**
 * CSL locale data as a compiled style reads it at format time.
 *
 * `readLocaleLayer` reads a `<locale>` element — a locale file's root, or one of a style's own —
 * into a locale layer: the shape `@citestyle/core`'s `localize` merges and `@citestyle/locales`
 * ships (see packages/core/src/locale.js). It keeps what the format-time code needs and the
 * compile-time resolution in ./locale.js never kept: a term's text exactly as written (en-US " AD",
 * French "« " and " »" with their no-break spaces), gender-form variants, `match`, and the gender
 * of nouns.
 */
import { DOMParser } from '@xmldom/xmldom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'locales')

/**
 * Read a CSL locale file.
 *
 * @param {string} xml
 * @returns {{ layer: object, info: { translators: object[], rights: { text: string, license: string|null } | null, updated: string|null } }}
 */
export function readLocaleFile(xml) {
  const root = new DOMParser().parseFromString(xml, 'text/xml').documentElement
  if (!root || localName(root) !== 'locale') throw new Error('Invalid CSL locale: root element must be <locale>')
  return { layer: readLocaleLayer(root), info: readInfo(root) }
}

/**
 * The en-US locale file the compiler ships, as a layer: the base every compiled style carries.
 *
 * @returns {object}
 */
export function loadEnglishLayer() {
  return readLocaleFile(readFileSync(join(LOCALES_DIR, 'locales-en-US.xml'), 'utf-8')).layer
}

/**
 * Read a `<locale>` element into a locale layer.
 *
 * @param {Element} el
 * @returns {object}
 */
export function readLocaleLayer(el) {
  const layer = { terms: {}, variants: {}, match: {}, genders: {}, dates: {}, options: {} }
  const lang = attr(el, 'xml:lang') ?? attr(el, 'lang')
  if (lang) layer.lang = lang

  for (const child of childElements(el)) {
    const name = localName(child)
    if (name === 'terms') {
      for (const termEl of childElements(child)) {
        if (localName(termEl) === 'term') readTerm(termEl, layer)
      }
    } else if (name === 'date') {
      const form = attr(child, 'form')
      if (form) layer.dates[form] = readDateFormat(child)
    } else if (name === 'style-options') {
      const piq = attr(child, 'punctuation-in-quote')
      if (piq != null) layer.options.punctuationInQuote = piq === 'true'
      const limit = attr(child, 'limit-day-ordinals-to-day-1')
      if (limit != null) layer.options.limitDayOrdinalsToDay1 = limit === 'true'
    }
  }

  for (const key of Object.keys(layer)) {
    if (layer[key] && typeof layer[key] === 'object' && Object.keys(layer[key]).length === 0) delete layer[key]
  }
  return layer
}

function readTerm(termEl, layer) {
  const name = attr(termEl, 'name')
  if (!name) return
  const form = attr(termEl, 'form') || 'long'
  const key = form === 'long' ? name : name + ':' + form
  const single = findChild(termEl, 'single')
  const multiple = findChild(termEl, 'multiple')
  let value
  if (single || multiple) {
    value = {}
    if (single) value.single = termText(single)
    if (multiple) value.multiple = termText(multiple)
  } else {
    value = termText(termEl)
  }

  const genderForm = attr(termEl, 'gender-form')
  if (genderForm) {
    ;(layer.variants[key] ||= {})[genderForm] = value
  } else {
    layer.terms[key] = value
  }
  const match = attr(termEl, 'match')
  if (match) layer.match[key] = match
  const gender = attr(termEl, 'gender')
  if (gender && form === 'long') layer.genders[name] = gender
}

/**
 * A term's text as written. Whitespace is a term's own (" AD", "« ") except where it holds a line
 * break, which is only the XML's layout.
 */
function termText(el) {
  let text = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === 3 || child.nodeType === 4) text += child.nodeValue || ''
  }
  return /[\r\n]/.test(text) ? text.trim() : text
}

function readDateFormat(dateEl) {
  const format = { parts: [] }
  const delimiter = attr(dateEl, 'delimiter')
  if (delimiter) format.delimiter = delimiter
  for (const child of childElements(dateEl)) {
    if (localName(child) !== 'date-part') continue
    const part = { name: attr(child, 'name') }
    const form = attr(child, 'form')
    if (form) part.form = form
    const prefix = attr(child, 'prefix')
    if (prefix) part.prefix = prefix
    const suffix = attr(child, 'suffix')
    if (suffix) part.suffix = suffix
    const rangeDelimiter = attr(child, 'range-delimiter')
    if (rangeDelimiter != null) part.rangeDelimiter = rangeDelimiter
    if (attr(child, 'strip-periods') === 'true') part.stripPeriods = true
    format.parts.push(part)
  }
  return format
}

function readInfo(root) {
  const info = { translators: [], rights: null, updated: null }
  const infoEl = findChild(root, 'info')
  if (!infoEl) return info
  for (const child of childElements(infoEl)) {
    const name = localName(child)
    if (name === 'translator') {
      const person = {}
      for (const field of childElements(child)) person[localName(field)] = termText(field).trim()
      info.translators.push(person)
    } else if (name === 'rights') {
      info.rights = { text: termText(child).trim(), license: attr(child, 'license') }
    } else if (name === 'updated') {
      info.updated = termText(child).trim()
    }
  }
  return info
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function localName(el) {
  return el.localName || el.nodeName?.replace(/^.*:/, '')
}

function attr(el, name) {
  if (!el.hasAttribute?.(name)) return null
  return el.getAttribute(name)
}

function childElements(el) {
  const result = []
  if (!el.childNodes) return result
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 1) result.push(el.childNodes[i])
  }
  return result
}

function findChild(el, name) {
  for (const child of childElements(el)) {
    if (localName(child) === name) return child
  }
  return null
}
