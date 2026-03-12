/**
 * CSL Locale Resolution.
 *
 * Merges locale terms from: style locale overrides → locale file → en-US fallback.
 * All resolved at compile time — no runtime locale loading.
 */
import { DOMParser } from '@xmldom/xmldom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'locales')

/**
 * Load and parse a locale XML file.
 *
 * @param {string} lang - Locale identifier (e.g., 'en-US')
 * @returns {LocaleData | null}
 */
export function loadLocaleFile(lang) {
  try {
    const path = join(LOCALES_DIR, `locales-${lang}.xml`)
    const xml = readFileSync(path, 'utf-8')
    return parseLocaleXml(xml)
  } catch {
    return null
  }
}

/**
 * Parse a locale XML string.
 *
 * @param {string} xml
 * @returns {LocaleData}
 */
export function parseLocaleXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  const data = {
    lang: attr(root, 'xml:lang') || attr(root, 'lang') || '',
    terms: {},
    dateFormats: {},
    styleOptions: {},
    ordinalTerms: {},
  }

  for (const child of childElements(root)) {
    const name = localName(child)

    if (name === 'terms') {
      parseTerms(child, data)
    } else if (name === 'date') {
      const form = attr(child, 'form')
      data.dateFormats[form] = parseDateFormat(child)
    } else if (name === 'style-options') {
      data.styleOptions = {
        punctuationInQuote: attr(child, 'punctuation-in-quote') === 'true',
        limitDayOrdinalsToDay1: attr(child, 'limit-day-ordinals-to-day-1') === 'true',
      }
    }
  }

  return data
}

/**
 * Parse <terms> element.
 */
function parseTerms(termsEl, data) {
  for (const termEl of childElements(termsEl)) {
    if (localName(termEl) !== 'term') continue

    const name = attr(termEl, 'name')
    const form = attr(termEl, 'form') || 'long'
    const gender = attr(termEl, 'gender')
    const genderForm = attr(termEl, 'gender-form')

    // Build key: "term-name" for long, "term-name:form" for others
    let key = name
    if (form !== 'long') key = name + ':' + form

    // Check for single/multiple child elements
    const single = findChild(termEl, 'single')
    const multiple = findChild(termEl, 'multiple')

    if (single && multiple) {
      data.terms[key] = {
        single: textContent(single),
        multiple: textContent(multiple),
      }
    } else {
      data.terms[key] = textContent(termEl)
    }

    // Track ordinal terms separately for number formatting
    if (name.startsWith('ordinal')) {
      data.ordinalTerms[name] = typeof data.terms[key] === 'string'
        ? data.terms[key]
        : data.terms[key].single || ''
    }

    // Track gender
    if (gender) {
      data.terms[key + ':gender'] = gender
    }
  }
}

/**
 * Parse a locale <date> format.
 */
function parseDateFormat(dateEl) {
  const parts = []
  for (const child of childElements(dateEl)) {
    if (localName(child) === 'date-part') {
      parts.push({
        name: attr(child, 'name'),
        form: attr(child, 'form'),
        prefix: attr(child, 'prefix') || '',
        suffix: attr(child, 'suffix') || '',
        rangeDelimiter: attr(child, 'range-delimiter'),
        textCase: attr(child, 'text-case'),
        stripPeriods: attr(child, 'strip-periods') === 'true',
      })
    }
  }
  return { parts, delimiter: attr(dateEl, 'delimiter') || '' }
}

/**
 * Resolve the complete locale for a given language.
 *
 * Merge order (later overrides earlier):
 * 1. en-US fallback (always loaded)
 * 2. Primary language locale file (e.g., fr-FR)
 * 3. Style-level locale overrides
 *
 * @param {string} lang - Target language
 * @param {Array} styleLocaleOverrides - From the parsed CSL AST
 * @returns {ResolvedLocale}
 */
export function resolveLocale(lang, styleLocaleOverrides = []) {
  const resolved = {
    terms: {},
    dateFormats: {},
    styleOptions: {},
    ordinalTerms: {},
    monthTerms: {},
    seasonTerms: {},
  }

  // 1. Load en-US as fallback
  const enUS = loadLocaleFile('en-US')
  if (enUS) mergeLocale(resolved, enUS)

  // 2. Load target locale (if not en-US)
  if (lang && lang !== 'en-US') {
    const target = loadLocaleFile(lang)
    if (target) mergeLocale(resolved, target)

    // Try base language fallback (e.g., 'fr' for 'fr-FR')
    if (!target && lang.includes('-')) {
      const base = loadLocaleFile(lang.split('-')[0])
      if (base) mergeLocale(resolved, base)
    }
  }

  // 3. Apply style-level locale overrides
  for (const override of styleLocaleOverrides) {
    if (!override.lang || override.lang === lang) {
      if (override.terms) Object.assign(resolved.terms, override.terms)
      if (override.dateFormats) Object.assign(resolved.dateFormats, override.dateFormats)
      if (override.styleOptions) Object.assign(resolved.styleOptions, override.styleOptions)
    }
  }

  // Extract month and season terms for the date formatter
  for (let i = 1; i <= 12; i++) {
    resolved.monthTerms[String(i)] = resolved.terms['month-' + String(i).padStart(2, '0')] || ''
  }
  for (let i = 1; i <= 4; i++) {
    resolved.seasonTerms[String(i)] = resolved.terms['season-0' + i] || ''
  }

  return resolved
}

function mergeLocale(target, source) {
  Object.assign(target.terms, source.terms)
  Object.assign(target.dateFormats, source.dateFormats)
  Object.assign(target.styleOptions, source.styleOptions)
  Object.assign(target.ordinalTerms, source.ordinalTerms)
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function localName(el) {
  return el.localName || el.nodeName?.replace(/^.*:/, '')
}

function attr(el, name) {
  if (!el.hasAttribute?.(name)) return null
  return el.getAttribute(name)
}

function textContent(el) {
  let text = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === 3 || child.nodeType === 4) {
      text += child.nodeValue || ''
    } else if (child.nodeType === 1) {
      text += textContent(child)
    }
  }
  return text.trim()
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
