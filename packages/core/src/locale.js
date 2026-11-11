/**
 * Locales at format time.
 *
 * A compiled style carries three pieces of locale data: the en-US terms, dates and options it can
 * reach (`base`), its own `<locale>` elements keyed by xml:lang (`own`), and its default locale, as
 * a pack. That pack, or a locale pack passed as `locale` (one module per CSL locale, from
 * `@citestyle/locales`), is merged over the first two here, once per pack and style, into a
 * resolved locale that the style's code reads its terms, ordinals, dates and quotes from.
 *
 * A locale layer — a pack, or one `<locale>` element — is plain data (it survives a JSON round
 * trip unchanged, so packs can be served as static files) and has this shape:
 *
 *   {
 *     version: 1,                                       // a pack's format (packs only)
 *     lang: 'fr-FR',
 *     terms:    { 'and': 'et', 'editor:short': { single: 'éd.', multiple: 'éd.' }, … },
 *     variants: { 'ordinal-01': { feminine: 'ʳᵉ', masculine: 'ᵉʳ' } },   // gender-form terms
 *     match:    { 'ordinal-01': 'whole-number' },
 *     genders:  { 'edition': 'feminine', 'month-01': 'masculine' },      // nouns' genders
 *     dates:    { text: { parts: [{ name: 'day', suffix: ' ' }, …], delimiter }, numeric: … },
 *     options:  { punctuationInQuote: false, limitDayOrdinalsToDay1: true },
 *   }
 *
 * Terms are keyed "name" for the long form and "name:form" for the others.
 */

/** The locale pack format this code reads. */
export const LOCALE_FORMAT = 1

// The ordinal suffix terms, which CSL replaces as a set: a locale that defines any of them
// replaces all those below it ("ordinal" and "ordinal-00" through "ordinal-99")
const ORDINAL_SET = /^ordinal(-\d\d)?$/

const warned = new WeakSet()

/**
 * Merge two locale layers: `upper` wins, with CSL 1.0.2's rules for what a layer replaces.
 * Each form of a term is replaced on its own, with its gender variants and its gender; defining
 * any ordinal suffix term replaces them all; a date format, or an option, is replaced whole.
 *
 * @param {object} lower
 * @param {object} [upper]
 * @returns {object} a new layer
 */
export function mergeLayers(lower, upper) {
  if (!upper) return lower
  const out = {
    version: upper.version ?? lower.version,
    lang: upper.lang ?? lower.lang,
    terms: { ...lower.terms },
    variants: { ...lower.variants },
    match: { ...lower.match },
    genders: { ...lower.genders },
    dates: { ...lower.dates, ...upper.dates },
    options: { ...lower.options, ...upper.options },
  }
  const terms = upper.terms || {}
  const variants = upper.variants || {}
  const match = upper.match || {}
  const genders = upper.genders || {}
  const units = new Set([...Object.keys(terms), ...Object.keys(variants)])
  for (const unit of units) {
    if (ORDINAL_SET.test(unit)) {
      for (const map of [out.terms, out.variants, out.match]) {
        for (const key of Object.keys(map)) if (ORDINAL_SET.test(key)) delete map[key]
      }
      break
    }
  }
  for (const unit of units) {
    setOrDelete(out.terms, unit, terms)
    setOrDelete(out.variants, unit, variants)
    setOrDelete(out.match, unit, match)
    // A noun's gender belongs to its long form
    if (!unit.includes(':')) setOrDelete(out.genders, unit, genders)
  }
  return out
}

function setOrDelete(target, key, source) {
  if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key]
  else delete target[key]
}

/**
 * Resolve a locale pack for a compiled style, with CSL 1.0.2's locale fallback. From lowest to
 * highest: the en-US data the style carries; the pack (its dialect, already merged over its
 * language's primary dialect); the style's `<locale>` without xml:lang; its `<locale>` for the
 * pack's language; its `<locale>` for the pack's dialect.
 *
 * A pack in a format this code doesn't read (its `version` isn't LOCALE_FORMAT) gives null, with a
 * console warning the first time: the style then formats in its own default locale.
 *
 * @param {object} pack - a locale pack, e.g. the default export of `@citestyle/locales/fr-FR`
 * @param {object} base - the en-US layer the style carries
 * @param {Record<string, object>} [own] - the style's `<locale>` layers, by xml:lang ('' for none)
 * @returns {object | null} a resolved locale, for the style's code
 */
export function localize(pack, base, own = {}) {
  if (!pack || typeof pack !== 'object') {
    throw new TypeError(
      'locale must be a locale pack object, such as the default export of @citestyle/locales/fr-FR, not ' +
        (typeof pack === 'string' ? `the string "${pack}"` : String(pack)),
    )
  }
  if (pack.version !== LOCALE_FORMAT) {
    if (!warned.has(pack)) {
      warned.add(pack)
      if (typeof console !== 'undefined') {
        const has = pack.version === undefined ? 'has no format version' : `has format version ${JSON.stringify(pack.version)}`
        console.warn(
          `citestyle: the locale pack${pack.lang ? ' ' + pack.lang : ''} ${has}, and this style reads ` +
            `version ${LOCALE_FORMAT}; it formats in its default locale instead.`,
        )
      }
    }
    return null
  }
  const lang = pack.lang || ''
  const language = lang.split('-')[0]
  let layer = mergeLayers(base, pack)
  layer = mergeLayers(layer, own[''])
  layer = mergeLayers(layer, own[language])
  if (lang !== language) layer = mergeLayers(layer, own[lang])

  const t = layer.terms
  const options = layer.options || {}
  const months = {}
  for (let i = 1; i <= 12; i++) months[i] = text(t['month-' + pad2(i)])
  const seasons = {}
  for (let i = 1; i <= 4; i++) seasons[i] = text(t['season-0' + i])
  return {
    lang,
    t,
    v: layer.variants,
    m: layer.match,
    g: layer.genders,
    df: layer.dates,
    dc: [],
    q: options.punctuationInQuote === true,
    Q: quoteClass(t['close-quote'], t['close-inner-quote']),
    l1: options.limitDayOrdinalsToDay1 === true,
    prd: typeof t['page-range-delimiter'] === 'string' ? t['page-range-delimiter'] : undefined,
    months,
    seasons,
  }
}

/**
 * A term's text, singular or plural. A form the locale doesn't define falls back as CSL says,
 * after locale fallback: "verb-short" to "verb", "symbol" to "short", and each to the long form.
 * A form defined as empty is found, and empty (AMS's `<multiple/>` for "page" drops the label).
 *
 * @param {object} L - a resolved locale
 * @param {string} key - "name" or "name:form"
 * @param {boolean} [plural]
 * @returns {string}
 */
export function getTerm(L, key, plural) {
  let v = L.t[key]
  if (v == null) v = formFallback(L.t, key)
  if (v == null) return ''
  return typeof v === 'string' ? v : plural ? (v.multiple ?? v.single ?? '') : (v.single ?? '')
}

function formFallback(t, key) {
  const i = key.lastIndexOf(':')
  if (i < 0) return undefined
  const name = key.slice(0, i)
  const form = key.slice(i + 1)
  const next = form === 'verb-short' ? 'verb' : form === 'symbol' ? 'short' : null
  if (next && t[name + ':' + next] != null) return t[name + ':' + next]
  return t[name]
}

/**
 * Render a number as an ordinal ("2nd", "2ᵉ", "2.") or a long ordinal ("second", "deuxième"),
 * with CSL's ordinal terms and the gender of the noun it counts.
 *
 * @param {object} L - a resolved locale
 * @param {number} n
 * @param {string} [noun] - the term whose gender the ordinal takes ("edition", "month-01")
 * @param {boolean} [long] - the long-ordinal form
 * @returns {string}
 */
export function formatOrdinal(L, n, noun, long) {
  const gender = noun ? L.g[noun] : undefined
  if (long && n >= 1 && n <= 10 && Number.isInteger(n)) {
    const word = gendered(L, 'long-ordinal-' + pad2(n), gender)
    if (word != null) return word
  }
  return String(n) + ordinalSuffix(L, n, gender)
}

/**
 * The ordinal suffix for a number, as CSL 1.0.2 resolves it: "ordinal-10" to "ordinal-99" match the
 * last two digits (or, with match="whole-number", the number); "ordinal-00" to "ordinal-09" the
 * last digit (or the last two digits, or the number); the former win; "ordinal" is the default.
 * A locale that defines no "ordinal" but "ordinal-01" to "ordinal-04" uses the CSL 1.0 scheme.
 */
function ordinalSuffix(L, n, gender) {
  const abs = Math.abs(Math.trunc(n))
  const two = abs % 100
  const one = abs % 10
  const defined = (key) => L.t[key] != null || L.v[key] != null
  if (!defined('ordinal') && ['01', '02', '03', '04'].some((k) => defined('ordinal-' + k))) {
    const k = one === 1 && two !== 11 ? '01' : one === 2 && two !== 12 ? '02' : one === 3 && two !== 13 ? '03' : '04'
    return gendered(L, 'ordinal-' + k, gender) ?? ''
  }
  let v
  if (two >= 10) {
    const key = 'ordinal-' + two
    if (defined(key) && (L.m[key] !== 'whole-number' || abs === two)) v = gendered(L, key, gender)
  }
  if (v == null) {
    const key = 'ordinal-0' + one
    const m = L.m[key]
    if (defined(key) && (m === 'whole-number' ? abs === one : m === 'last-two-digits' ? two === one : true)) {
      v = gendered(L, key, gender)
    }
  }
  if (v == null) v = gendered(L, 'ordinal', gender)
  return v ?? ''
}

// A term in the gender asked for, else its neuter form (the term without gender-form)
function gendered(L, key, gender) {
  const g = gender ? L.v[key]?.[gender] : undefined
  return g != null ? g : L.t[key]
}

/**
 * The configuration `formatDate` takes for one `<date>` of a style, in a resolved locale. A
 * localized date (form "text" or "numeric") takes the locale's date format: its parts, in its
 * order, with its delimiter; the style's `<date-part>` children override their attributes, but not
 * their affixes. A date of the style's own takes its parts and its delimiter. The `date-parts`
 * attribute keeps only the parts it names.
 *
 * @param {object} L - a resolved locale
 * @param {{ form?: string, dp?: string, delimiter?: string, parts?: object[] }} spec - the style's `<date>`
 * @returns {object}
 */
export function dateConfig(L, spec) {
  let parts = spec.parts || []
  let delimiter = spec.delimiter || ''
  const format = spec.form ? L.df?.[spec.form] : null
  if (format) {
    const own = parts
    parts = format.parts.map((part) => {
      const o = own.find((p) => p.name === part.name)
      if (!o) return part
      const { prefix, suffix, ...attrs } = o
      return { ...part, ...attrs }
    })
    delimiter = format.delimiter || ''
  }
  if (spec.dp && parts.length > 0) {
    const allowed = spec.dp.split('-')
    parts = parts.filter((p) => allowed.includes(p.name))
  }
  return { dateParts: parts, delimiter, monthTerms: L.months, seasonTerms: L.seasons, locale: L }
}

/**
 * Day of the month as an ordinal, in a resolved locale: with the month's gender, and only for the
 * first day when the locale limits day ordinals to day 1 (French "1er", "2").
 *
 * @param {object} L - a resolved locale
 * @param {number} day
 * @param {number} [month]
 * @returns {string}
 */
export function dayOrdinal(L, day, month) {
  if (L.l1 && Number(day) !== 1) return String(day)
  return formatOrdinal(L, Number(day), month != null ? 'month-' + pad2(month) : undefined)
}

// The regex character class of a locale's closing quotes, for moving punctuation inside them
function quoteClass(close, closeInner) {
  const chars = (text(close) || '”') + (text(closeInner) || '’')
  // A quote's own spacing (French « » carry a no-break space) is not a quote
  const unique = [...new Set(chars.replace(/\s/g, ''))]
  return '[' + unique.map((c) => (/[\]\\^-]/.test(c) ? '\\' + c : c)).join('') + ']'
}

function text(term) {
  return typeof term === 'string' ? term : term?.single || ''
}

function pad2(n) {
  return String(n).padStart(2, '0')
}
