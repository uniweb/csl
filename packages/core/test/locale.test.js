import { describe, it, expect, vi, afterEach } from 'vitest'
import { localize, mergeLayers, getTerm, labelTerm, formatOrdinal, dayOrdinal, dateConfig, LOCALE_FORMAT } from '../src/locale.js'
import { formatDate } from '../src/dates.js'
import { pageRange } from '../src/pages.js'

// en-US as a style carries it: a few terms, its ordinals, its date formats and options
const EN = {
  lang: 'en-US',
  terms: {
    and: 'and', in: 'in', 'et-al': 'et al.', 'editor:short': { single: 'ed.', multiple: 'eds.' },
    'month-01': 'January', 'month-01:short': 'Jan.', 'month-03': 'March', 'month-03:short': 'Mar.',
    'season-01': 'Spring', 'close-quote': '”', 'close-inner-quote': '’', 'page-range-delimiter': '–',
    ordinal: 'th', 'ordinal-01': 'st', 'ordinal-02': 'nd', 'ordinal-03': 'rd', 'ordinal-11': 'th', 'ordinal-12': 'th', 'ordinal-13': 'th',
    'long-ordinal-01': 'first', 'long-ordinal-02': 'second',
  },
  dates: {
    text: { parts: [{ name: 'month', suffix: ' ' }, { name: 'day', suffix: ', ' }, { name: 'year' }] },
    numeric: { parts: [{ name: 'month', form: 'numeric-leading-zeros', suffix: '/' }, { name: 'day', form: 'numeric-leading-zeros', suffix: '/' }, { name: 'year' }] },
  },
  options: { punctuationInQuote: true },
}

// The French pack, cut down to what these tests read
const FR = {
  version: 1,
  lang: 'fr-FR',
  terms: {
    and: 'et', 'et-al': 'et al.', 'month-01': 'janvier', 'month-01:short': 'janv.', 'month-03': 'mars',
    edition: { single: 'édition', multiple: 'éditions' }, page: { single: 'page', multiple: 'pages' },
    'open-quote': '« ', 'close-quote': ' »', 'page-range-delimiter': '‑',
    ordinal: 'ᵉ', 'long-ordinal-01': 'premier',
  },
  variants: { 'ordinal-01': { feminine: 'ʳᵉ', masculine: 'ᵉʳ' }, 'long-ordinal-01': { feminine: 'première' } },
  match: { 'ordinal-01': 'whole-number' },
  genders: { edition: 'feminine', 'month-01': 'masculine', 'month-03': 'masculine' },
  dates: { text: { parts: [{ name: 'day', suffix: ' ' }, { name: 'month', suffix: ' ' }, { name: 'year' }] } },
  options: { punctuationInQuote: false, limitDayOrdinalsToDay1: true },
}

afterEach(() => vi.restoreAllMocks())

describe('localize: CSL 1.0.2 locale fallback', () => {
  it('draws each term from the highest layer that defines it', () => {
    const L = localize(FR, EN)
    expect(getTerm(L, 'and')).toBe('et') // the pack
    expect(getTerm(L, 'in')).toBe('in') // en-US, which the pack lacks
    expect(getTerm(L, 'editor:short', true)).toBe('eds.')
  })

  it('applies the style\'s own <locale> elements over the pack: none < language < dialect', () => {
    const own = {
      '': { terms: { and: 'GENERIC', in: 'GENERIC', 'et-al': 'GENERIC' } },
      fr: { terms: { and: 'LANGUAGE', in: 'LANGUAGE' } },
      'fr-FR': { terms: { and: 'DIALECT' } },
      'fr-CA': { terms: { and: 'OTHER DIALECT' } },
      de: { terms: { and: 'OTHER LANGUAGE' } },
    }
    const L = localize(FR, EN, own)
    expect(getTerm(L, 'and')).toBe('DIALECT')
    expect(getTerm(L, 'in')).toBe('LANGUAGE')
    expect(getTerm(L, 'et-al')).toBe('GENERIC')
  })

  it('reads a language-only pack lang ("ar") once, for both its language and its dialect', () => {
    const L = localize({ version: 1, lang: 'ar', terms: { and: 'و' } }, EN, { ar: { terms: { in: 'في' } } })
    expect(getTerm(L, 'and')).toBe('و')
    expect(getTerm(L, 'in')).toBe('في')
  })

  it('stops at a term defined as empty, as CSL says', () => {
    const L = localize({ version: 1, lang: 'xx-XX', terms: { and: '', 'page:short': { single: 'p.', multiple: '' } } }, EN)
    expect(getTerm(L, 'and')).toBe('')
    expect(getTerm(L, 'page:short')).toBe('p.')
    expect(getTerm(L, 'page:short', true)).toBe('') // <multiple/>: no label for a range
  })

  it('falls back to another form only after every locale lacks the form asked for', () => {
    const L = localize({ version: 1, lang: 'xx-XX', terms: { in: 'dans', 'editor:verb': 'édité par' } }, EN)
    expect(getTerm(L, 'in:short')).toBe('dans') // short → long
    expect(getTerm(L, 'editor:verb-short')).toBe('édité par') // verb-short → verb
    expect(getTerm(L, 'editor:short')).toBe('ed.') // en-US has the short form: locale fallback first
    expect(getTerm(L, 'nothing:short')).toBe('')
  })

  it('takes punctuation-in-quote, the closing quotes and the page-range delimiter from the locale', () => {
    const fr = localize(FR, EN)
    expect(fr.q).toBe(false)
    expect(fr.prd).toBe('‑')
    expect(fr.Q).toBe('[»’]') // a quote's own no-break space is not a quote
    const xx = localize({ version: 1, lang: 'xx-XX' }, EN)
    expect(xx.q).toBe(true)
    expect(xx.Q).toBe('[”’]')
  })

  it('formats in the style\'s default locale, with one warning, for a pack format it doesn\'t read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const future = { version: 2, lang: 'fr-FR', terms: { and: 'et' } }
    expect(localize(future, EN)).toBeNull()
    expect(localize(future, EN)).toBeNull()
    expect(localize({ lang: 'fr-FR' }, EN)).toBeNull()
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toContain('format version 2')
    expect(warn.mock.calls[1][0]).toContain('has no format version')
    expect(LOCALE_FORMAT).toBe(1)
  })

  it('refuses a string, which is not a pack', () => {
    expect(() => localize('fr-FR', EN)).toThrow(/the string "fr-FR"/)
  })
})

describe('labelTerm', () => {
  it('takes the plural for a range, a list, several names or a number other than 1', () => {
    const L = localize({ version: 1, lang: 'xx-XX', terms: { 'page:short': { single: 'p.', multiple: 'pp.' }, 'editor:short': { single: 'ed.', multiple: 'eds.' } } }, EN)
    expect(labelTerm(L, 'page:short', '42')).toBe('p.')
    expect(labelTerm(L, 'page:short', '42-45')).toBe('pp.')
    expect(labelTerm(L, 'page:short', '4, 9')).toBe('pp.')
    expect(labelTerm(L, 'page:short', 2)).toBe('pp.')
    expect(labelTerm(L, 'editor:short', [{ family: 'A' }])).toBe('ed.')
    expect(labelTerm(L, 'editor:short', [{ family: 'A' }, { family: 'B' }])).toBe('eds.')
    expect(labelTerm(L, 'editor:short', [])).toBe('')
    expect(labelTerm(L, 'page:short', '')).toBe('')
  })
})

describe('mergeLayers', () => {
  it('replaces a term with its gender variants and its gender, form by form', () => {
    const lower = { terms: { edition: 'edition', 'edition:short': 'ed.' }, genders: { edition: 'feminine' }, variants: { 'long-ordinal-01': { feminine: 'première' } } }
    const upper = { terms: { edition: 'Auflage', 'long-ordinal-01': 'erste' } }
    const merged = mergeLayers(lower, upper)
    expect(merged.terms.edition).toBe('Auflage')
    expect(merged.terms['edition:short']).toBe('ed.')
    expect(merged.genders.edition).toBeUndefined() // the upper layer's "edition" has no gender
    expect(merged.variants['long-ordinal-01']).toBeUndefined()
  })

  it('replaces all ordinal suffix terms when a layer defines any of them', () => {
    const merged = mergeLayers(EN, { terms: { ordinal: '.' } })
    expect(merged.terms.ordinal).toBe('.')
    expect(merged.terms['ordinal-01']).toBeUndefined()
    expect(merged.terms['ordinal-13']).toBeUndefined()
    expect(merged.terms['long-ordinal-01']).toBe('first') // not an ordinal suffix term
  })

  it('replaces a date format whole, and options one by one', () => {
    const merged = mergeLayers(EN, { dates: { text: FR.dates.text }, options: { limitDayOrdinalsToDay1: true } })
    expect(merged.dates.text).toBe(FR.dates.text)
    expect(merged.dates.numeric).toBe(EN.dates.numeric)
    expect(merged.options).toEqual({ punctuationInQuote: true, limitDayOrdinalsToDay1: true })
  })
})

describe('formatOrdinal', () => {
  it('reads en-US\'s ordinal terms with CSL\'s matching', () => {
    const L = localize({ version: 1, lang: 'en-GB' }, EN)
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 100, 101, 111, 112, 113].map((n) => formatOrdinal(L, n))).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '100th', '101st', '111th', '112th', '113th'])
  })

  it('takes the noun\'s gender, with match="whole-number"', () => {
    const L = localize(FR, EN)
    expect(formatOrdinal(L, 1, 'edition')).toBe('1ʳᵉ') // 1re éd.
    expect(formatOrdinal(L, 1, 'month-01')).toBe('1ᵉʳ') // 1er janvier
    expect(formatOrdinal(L, 21, 'edition')).toBe('21ᵉ') // whole-number: 21e, not 21re
    expect(formatOrdinal(L, 2, 'edition')).toBe('2ᵉ') // French replaced the English set: not 2nd
    expect(formatOrdinal(L, 1)).toBe('1ᵉ') // no neuter variant of ordinal-01: the default
  })

  it('renders long ordinals 1 to 10 as words in the noun\'s gender, others as ordinals', () => {
    const L = localize(FR, EN)
    expect(formatOrdinal(L, 1, 'edition', true)).toBe('première')
    expect(formatOrdinal(L, 1, 'month-01', true)).toBe('premier') // no masculine variant: the neuter form
    expect(formatOrdinal(L, 2, 'edition', true)).toBe('second') // the pack lacks it: en-US's
    expect(formatOrdinal(L, 11, 'edition', true)).toBe('11ᵉ')
  })

  it('uses the CSL 1.0 scheme for a locale with ordinal-01 to -04 and no "ordinal"', () => {
    const L = localize({ version: 1, lang: 'xx-XX', terms: { 'ordinal-01': 'a', 'ordinal-02': 'b', 'ordinal-03': 'c', 'ordinal-04': 'd' } }, EN)
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 24].map((n) => formatOrdinal(L, n).replace(/\d+/, ''))).toEqual(
      ['a', 'b', 'c', 'd', 'd', 'd', 'd', 'a', 'b', 'c', 'd'])
  })

  it('matches "ordinal-00" to "-09" on the last two digits with match="last-two-digits"', () => {
    const L = localize({ version: 1, lang: 'xx-XX', terms: { ordinal: 'x', 'ordinal-03': 'y' }, match: { 'ordinal-03': 'last-two-digits' } }, EN)
    expect([3, 13, 23, 103].map((n) => formatOrdinal(L, n))).toEqual(['3y', '13x', '23x', '103y'])
  })
})

describe('day ordinals and dates in a resolved locale', () => {
  it('limits day ordinals to day 1 when the locale says so, with the month\'s gender', () => {
    const L = localize(FR, EN)
    expect(dayOrdinal(L, 1, 1)).toBe('1ᵉʳ')
    expect(dayOrdinal(L, 2, 1)).toBe('2')
  })

  it('builds a localized date from the locale\'s format: its order, its parts, not the style\'s affixes', () => {
    const L = localize(FR, EN)
    const cfg = dateConfig(L, { form: 'text', parts: [{ name: 'month', form: 'short', prefix: '(' }] })
    expect(cfg.dateParts).toEqual([{ name: 'day', suffix: ' ' }, { name: 'month', form: 'short', suffix: ' ' }, { name: 'year' }])
    expect(formatDate({ 'date-parts': [[2024, 1, 5]] }, cfg)).toBe('5 janv. 2024')
    expect(formatDate({ 'date-parts': [[2024, 3]] }, dateConfig(L, { form: 'text' }))).toBe('mars 2024')
    expect(formatDate({ 'date-parts': [[2024, 3, 9]] }, dateConfig(L, { form: 'text', dp: 'year-month' }))).toBe('mars 2024')
    expect(formatDate({ 'date-parts': [[2024, 3, 9]] }, dateConfig(L, { form: 'numeric' }))).toBe('03/09/2024') // en-US's
  })

  it('joins a non-localized date\'s parts with its own delimiter', () => {
    const L = localize(FR, EN)
    const cfg = dateConfig(L, { delimiter: ' ', parts: [{ name: 'day' }, { name: 'month' }, { name: 'year' }] })
    expect(formatDate({ 'date-parts': [[2024, 3, 1]] }, cfg)).toBe('1 mars 2024')
  })

  it('keeps a non-localized date\'s own parts, with the locale\'s month names', () => {
    const L = localize(FR, EN)
    const cfg = dateConfig(L, { parts: [{ name: 'year' }, { name: 'month', prefix: ', ' }, { name: 'day', prefix: ' ', form: 'ordinal' }] })
    expect(formatDate({ 'date-parts': [[2024, 1, 1]] }, cfg)).toBe('2024, janvier 1ᵉʳ')
  })

  it('joins a format\'s parts with its delimiter, and strips periods where asked', () => {
    const L = localize({ version: 1, lang: 'lv-LV', terms: { 'month-01:short': 'janv.' }, dates: { numeric: { parts: [{ name: 'day' }, { name: 'month', form: 'short', stripPeriods: true }, { name: 'year' }], delimiter: '.' } } }, EN)
    expect(formatDate({ 'date-parts': [[2024, 1, 5]] }, dateConfig(L, { form: 'numeric' }))).toBe('5.janv.2024')
  })

  it('renders a short month as its first three letters without a locale, as before', () => {
    const cfg = { dateParts: [{ name: 'month', form: 'short', suffix: ' ' }, { name: 'year' }] }
    expect(formatDate({ 'date-parts': [[2024, 9]] }, cfg)).toBe('Sep 2024')
  })
})

describe('pageRange delimiter', () => {
  it('joins a range with the locale\'s delimiter, an en-dash by default', () => {
    expect(pageRange('321-328', 'expanded')).toBe('321–328')
    expect(pageRange('321-328', 'chicago', '‑')).toBe('321‑28')
    expect(pageRange('321-328', 'minimal', '$&')).toBe('321$&8')
  })
})
