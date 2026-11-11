/**
 * The locale data a compiled style carries, and the code that resolves a locale at format time.
 *
 * Codegen records, as it writes the style's code, every locale value that code can read (`reach`).
 * From it this module emits:
 *
 *   EN      the en-US terms, dates and options the style can reach, as CSL's locale file gives
 *           them: the lowest layer under any locale
 *   OWN     the style's own <locale> elements, keyed by xml:lang ('' for none)
 *   DEF     the style's default locale (its default-locale, else en-US), as a pack of its own:
 *           what the style can reach of the locale's data, or nothing for en-US, which EN is
 *   L0      DEF resolved over EN and OWN, as any pack is: what the style formats with when no
 *           locale is passed
 *   _DATES  each <date> element, for building its configuration in a locale
 *
 * and `_locale(ctx)`, which returns L0, or the pack in ctx.locale resolved the same way (cached
 * per pack in a WeakMap).
 */
import { mergeLayers, LOCALE_FORMAT } from '@citestyle/core'
import { loadEnglishLayer } from './locale-data.js'

/** The terms a cite's locator label can name (CSL 1.0.2's locator types, and the older "number"). */
export const LOCATOR_TERMS = [
  'act', 'appendix', 'article-locator', 'book', 'canon', 'chapter', 'column', 'elocation', 'equation',
  'figure', 'folio', 'issue', 'line', 'note', 'opus', 'page', 'paragraph', 'part', 'rule', 'scene',
  'section', 'sub-verbo', 'supplement', 'table', 'timestamp', 'title-locator', 'verse', 'version',
  'volume', 'number',
]

const ORDINAL_SET = /^ordinal(-\d\d)?$/
const LONG_ORDINAL = /^long-ordinal-(0[1-9]|10)$/
const pad2 = (i) => String(i).padStart(2, '0')

let english
function englishLayer() {
  return (english ||= loadEnglishLayer())
}

/** A fresh record of the locale data a style's code can reach. */
export function createReach() {
  return {
    keys: new Set(), // terms read by key: getTerm, and/et-al, quotes
    locatorForms: new Set(), // forms of <label variable="locator">, whose key is the cite's label
    nouns: new Set(), // terms whose gender an ordinal takes
    months: false, // a date can render a month or season
    dayOrdinals: false, // a date can render the day as an ordinal
    ordinals: false, // a number or day can render as an ordinal
    longOrdinals: false,
    dateForms: new Set(), // localized date formats used ("text", "numeric")
    quotes: false,
    pageRanges: false,
    punctuation: false, // the bibliography moves punctuation inside closing quotes
  }
}

/**
 * The term keys a style's code reads: its reach, with the locator family.
 */
function readKeys(reach) {
  const keys = new Set(reach.keys)
  for (const form of reach.locatorForms) {
    for (const name of LOCATOR_TERMS) keys.add(form === 'long' ? name : name + ':' + form)
  }
  return keys
}

// The forms CSL falls back to when a form is missing: verb-short → verb → long, symbol → short → long
function fallbackKeys(key) {
  const i = key.lastIndexOf(':')
  if (i < 0) return []
  const name = key.slice(0, i)
  const form = key.slice(i + 1)
  if (form === 'verb-short') return [name + ':verb', name]
  if (form === 'symbol') return [name + ':short', name]
  return [name]
}

/**
 * Everything a locale layer must keep for the style to resolve a pack: the keys it reads, the
 * families it reaches by computed names, and the forms a missing one falls back to.
 */
function wantedKeys(reach, keys) {
  const wanted = new Set(keys)
  if (reach.quotes || reach.punctuation) {
    for (const k of ['open-quote', 'close-quote', 'open-inner-quote', 'close-inner-quote']) wanted.add(k)
  }
  if (reach.months) {
    for (let i = 1; i <= 12; i++) wanted.add('month-' + pad2(i)).add('month-' + pad2(i) + ':short')
    for (let i = 1; i <= 4; i++) wanted.add('season-0' + i)
  }
  if (reach.pageRanges) wanted.add('page-range-delimiter')
  // A noun's gender belongs to its long form, so the term travels with it
  for (const noun of nouns(reach)) wanted.add(noun)
  return wanted
}

function nouns(reach) {
  const set = new Set(reach.nouns)
  if (reach.dayOrdinals) for (let i = 1; i <= 12; i++) set.add('month-' + pad2(i))
  return set
}

/**
 * Keep only what the style can reach of a locale layer.
 *
 * @param {object} layer
 * @param {object} reach
 * @param {Set<string>} wanted - term keys to keep
 */
function restrict(layer, reach, wanted) {
  const keep = (key) =>
    wanted.has(key) || (reach.ordinals && ORDINAL_SET.test(key)) || (reach.longOrdinals && LONG_ORDINAL.test(key))
  const out = {}
  if (layer.lang) out.lang = layer.lang
  for (const field of ['terms', 'variants', 'match']) {
    const kept = {}
    for (const [key, value] of Object.entries(layer[field] || {})) if (keep(key)) kept[key] = value
    if (Object.keys(kept).length) out[field] = kept
  }
  const genderNouns = nouns(reach)
  const genders = {}
  for (const [key, value] of Object.entries(layer.genders || {})) if (genderNouns.has(key)) genders[key] = value
  if (Object.keys(genders).length) out.genders = genders
  const dates = {}
  for (const [form, format] of Object.entries(layer.dates || {})) if (reach.dateForms.has(form)) dates[form] = format
  if (Object.keys(dates).length) out.dates = dates
  const options = {}
  const opts = layer.options || {}
  if (reach.punctuation && opts.punctuationInQuote != null) options.punctuationInQuote = opts.punctuationInQuote
  if (reach.dayOrdinals && opts.limitDayOrdinalsToDay1 != null) options.limitDayOrdinalsToDay1 = opts.limitDayOrdinalsToDay1
  if (Object.keys(options).length) out.options = options
  return out
}

/**
 * The locale data and resolver a compiled style starts with.
 *
 * @param {object} args
 * @param {object} args.ast - the parsed style
 * @param {{ lang: string, layer: object }} args.locale - the style's default locale, from resolveLocale()
 * @param {object} args.reach - what the style's code reads (createReach), filled by codegen
 * @param {object[]} args.dates - each <date> element's description (dateSpec)
 * @returns {string[]} lines of code
 */
export function emitLocaleData({ ast, locale, reach, dates }) {
  const keys = readKeys(reach)
  const wanted = wantedKeys(reach, keys)

  // en-US: what the style reads, and where a form en-US lacks would fall back to
  const en = englishLayer()
  const enWanted = new Set(wanted)
  for (const key of wanted) {
    if (en.terms?.[key] == null && en.variants?.[key] == null) for (const k of fallbackKeys(key)) enWanted.add(k)
  }
  const EN = restrict({ ...en, lang: 'en-US' }, reach, enWanted)

  // A layer over EN keeps the forms a missing one falls back to as well
  const overWanted = new Set(wanted)
  for (const key of wanted) for (const k of fallbackKeys(key)) overWanted.add(k)

  // The style's own <locale> elements, by xml:lang
  const own = {}
  for (const override of ast.localeOverrides || []) {
    const lang = override.lang || ''
    const layer = restrict(override.layer || {}, reach, overWanted)
    delete layer.lang
    own[lang] = own[lang] ? mergeLayers(own[lang], layer) : layer
  }
  for (const lang of Object.keys(own)) {
    const layer = own[lang]
    for (const k of Object.keys(layer)) if (layer[k] && typeof layer[k] === 'object' && !Object.keys(layer[k]).length) delete layer[k]
    if (!Object.keys(layer).length) delete own[lang]
  }

  // The default locale, as a pack: en-US's data is EN itself
  const lang = locale.layer.lang || locale.lang || 'en-US'
  const DEF = { version: LOCALE_FORMAT, lang, ...(lang === 'en-US' ? {} : restrict(locale.layer, reach, overWanted)) }

  const lines = []
  lines.push('// Locale data. EN: the en-US terms, date formats and options this style can reach, as CSL\'s')
  lines.push('// locale file gives them. OWN: the style\'s own <locale> elements, by xml:lang. DEF: its default')
  lines.push('// locale, as a pack. L0, what it formats with when no locale is passed, is DEF resolved over')
  lines.push('// EN and OWN, as a pack passed as `locale` is.')
  lines.push(`const EN = ${JSON.stringify(EN)}`)
  lines.push(`const OWN = ${JSON.stringify(own)}`)
  lines.push(`const DEF = ${JSON.stringify(DEF)}`)
  lines.push(`const _DATES = ${JSON.stringify(dates)}`)
  lines.push('const L0 = localize(DEF, EN, OWN)')
  lines.push('')
  lines.push(`const _locales = new WeakMap()
function _locale(ctx) {
  const pack = ctx && ctx.locale
  if (!pack) return L0
  let L = _locales.get(pack)
  if (!L) _locales.set(pack, (L = localize(pack, EN, OWN) || L0))
  return L
}

function _date(L, i) {
  return L.dc[i] || (L.dc[i] = dateConfig(L, _DATES[i]))
}`)
  return lines
}

/**
 * A <date> element's description for building its configuration in a pack's locale: its form,
 * its date-parts attribute, and its own <date-part> children (only the attributes they set).
 */
export function dateSpec(node) {
  const spec = {}
  if (node.form) spec.form = node.form
  if (node.datePartsAttr) spec.dp = node.datePartsAttr
  const parts = (node.dateParts || []).map((dp) => {
    const part = { name: dp.name }
    if (dp.form) part.form = dp.form
    if (dp.prefix) part.prefix = dp.prefix
    if (dp.suffix) part.suffix = dp.suffix
    if (dp.rangeDelimiter != null) part.rangeDelimiter = dp.rangeDelimiter
    if (dp.stripPeriods) part.stripPeriods = true
    return part
  })
  if (parts.length) spec.parts = parts
  return spec
}
