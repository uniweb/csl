/**
 * CSL locale data as a compiled style reads it at format time.
 *
 * `readLocaleLayer` reads a `<locale>` element — a locale file's root, or one of a style's own —
 * into a locale layer: the shape `@citestyle/core`'s `localize` merges and `@citestyle/locales`
 * ships (see packages/core/src/locale.js): a term's text exactly as written (en-US " AD", French
 * "« " and " »" with their no-break spaces), gender-form variants, `match`, the gender of nouns,
 * date formats and options. `localeData` assembles a locale from the CSL locale files.
 */
import { DOMParser } from '@xmldom/xmldom'
import { mergeLayers } from '@citestyle/core'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * The official CSL locale files, unchanged from the commit locales/source.json names, with the CSL
 * project's primary-dialect table (locales.json). They are CC BY-SA 3.0, like every CSL locale file.
 */
const LOCALES_DIR = join(__dirname, '..', 'locales')

// The primary dialects CSL 1.0.2 lists (specification, "Locale Fallback"). locales.json, the CSL
// project's table, must agree; it also covers the languages the specification doesn't list.
const SPEC_PRIMARY_DIALECTS = { de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', zh: 'zh-CN' }

let primaries
/** Each language's primary dialect: { fr: 'fr-FR', pt: 'pt-PT', … } */
export function primaryDialects() {
  if (!primaries) {
    primaries = JSON.parse(readFileSync(join(LOCALES_DIR, 'locales.json'), 'utf-8'))['primary-dialects']
    for (const [language, primary] of Object.entries(SPEC_PRIMARY_DIALECTS)) {
      if (primaries[language] !== primary) {
        throw new Error(`locales.json makes ${primaries[language]} the primary dialect of "${language}"; CSL 1.0.2 says ${primary}`)
      }
    }
  }
  return primaries
}

/** Where the locale files come from: { repository, commit, date, license, licenseUrl } */
export function localeSource() {
  return JSON.parse(readFileSync(join(LOCALES_DIR, 'source.json'), 'utf-8'))
}

/** The locales the compiler has a file for, sorted: ['af-ZA', 'ar', …] */
export function availableLocales() {
  return readdirSync(LOCALES_DIR)
    .filter((f) => /^locales-.+\.xml$/.test(f))
    .map((f) => f.slice('locales-'.length, -'.xml'.length))
    .sort()
}

const files = new Map()
/**
 * One locale file, read: { file, layer, info }, or null when there is none for `lang`.
 *
 * @param {string} lang
 */
export function readLocale(lang) {
  if (!files.has(lang)) {
    const file = `locales-${lang}.xml`
    const path = join(LOCALES_DIR, file)
    files.set(lang, existsSync(path) ? { file, ...readLocaleFile(readFileSync(path, 'utf-8')) } : null)
  }
  return files.get(lang)
}

/**
 * A locale's data, as CSL's fallback assembles it from the locale files: the dialect's file over its
 * language's primary dialect (fr-CA over fr-FR); for a dialect with no file of its own, its
 * language's primary dialect (fr-CH takes fr-FR's), under its own lang. A language alone is its
 * primary dialect (fr is fr-FR), as CSL says. en-US is the base every style carries, so it is never
 * merged in. A locale of a language with no file has no data.
 *
 * @param {string} lang - e.g. 'fr-CA'
 * @returns {{ layer: object, sources: Array<{ file: string, info: object }> }}
 */
export function localeData(lang) {
  const language = lang.split('-')[0]
  const primary = primaryDialects()[language]
  if (lang === language && primary && primary !== lang) return localeData(primary)
  const own = readLocale(lang)
  const base = primary && primary !== lang && primary !== 'en-US' ? readLocale(primary) : null
  const sources = [base, own].filter(Boolean).map(({ file, info }) => ({ file, info }))
  if (own && base) return { layer: mergeLayers(base.layer, own.layer), sources }
  if (own) return { layer: own.layer, sources }
  if (base) return { layer: { ...base.layer, lang }, sources }
  return { layer: { lang }, sources }
}

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
 * The en-US locale file, as a layer: the base every compiled style carries.
 *
 * @returns {object}
 */
export function loadEnglishLayer() {
  return readLocale('en-US').layer
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
