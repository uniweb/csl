/**
 * Number formatting: ordinal, long-ordinal, roman numerals.
 */

/**
 * Format number as ordinal (1st, 2nd, 3rd, 4th, ...).
 *
 * @param {number} n
 * @param {object} [locale] - Locale ordinal config (for non-English)
 * @param {object} [locale.terms] - Ordinal terms from locale
 * @returns {string}
 */
export function ordinal(n, locale) {
  if (n == null) return ''
  n = Number(n)
  if (isNaN(n)) return String(n)

  // Use locale-specific ordinal terms if provided
  if (locale && locale.terms) {
    const suffix = resolveOrdinalTerm(n, locale.terms)
    if (suffix != null) return n + suffix
  }

  // English default
  const s = ['th', 'st', 'nd', 'rd']
  const v = Math.abs(n) % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Resolve ordinal suffix from locale terms.
 * CSL locales can define: ordinal, ordinal-00 through ordinal-99
 */
function resolveOrdinalTerm(n, terms) {
  const abs = Math.abs(n)
  // Try specific: ordinal-01, ordinal-02, ...
  const padded = String(abs % 100).padStart(2, '0')
  if (terms['ordinal-' + padded] != null) return terms['ordinal-' + padded]
  // Try last digit: ordinal-01, ordinal-02, ordinal-03, ordinal-04
  const lastDigit = String(abs % 10).padStart(2, '0')
  if (terms['ordinal-' + lastDigit] != null) return terms['ordinal-' + lastDigit]
  // Fallback to generic ordinal
  if (terms['ordinal'] != null) return terms['ordinal']
  return null
}

/**
 * Format number as long ordinal (first, second, third, ...).
 * Falls back to ordinal for numbers > 10.
 *
 * @param {number} n
 * @param {object} [locale]
 * @returns {string}
 */
export function longOrdinal(n, locale) {
  if (n == null) return ''
  n = Number(n)

  // Check locale long-ordinal terms
  if (locale && locale.terms) {
    const padded = String(Math.abs(n) % 100).padStart(2, '0')
    const term = locale.terms['long-ordinal-' + padded]
    if (term) return term
  }

  // English defaults for 1-10
  const LONG = ['', 'first', 'second', 'third', 'fourth', 'fifth',
    'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
  if (n >= 1 && n <= 10) return LONG[n]

  // Fall back to numeric ordinal
  return ordinal(n, locale)
}

/**
 * Format number as roman numeral.
 *
 * @param {number} n
 * @returns {string}
 */
export function roman(n) {
  if (n == null) return ''
  n = Number(n)
  if (isNaN(n) || n <= 0) return String(n)

  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I']

  let result = ''
  for (let i = 0; i < values.length; i++) {
    while (n >= values[i]) {
      result += symbols[i]
      n -= values[i]
    }
  }
  return result.toLowerCase()
}
