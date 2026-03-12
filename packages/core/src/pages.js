/**
 * Page range formatting.
 *
 * Supports expanded, chicago, minimal, and minimal-two algorithms
 * per the CSL page-range-format attribute.
 *
 * @param {string} pages - Raw page string (e.g., "321-328")
 * @param {string} [format] - 'chicago'|'expanded'|'minimal'|'minimal-two'
 * @returns {string} Formatted page range
 */
export function pageRange(pages, format) {
  if (!pages) return ''

  // Normalize hyphens to en-dash for output
  const normalized = pages.replace(/\s*[-\u2013]\s*/, '\u2013')

  if (!format || format === 'expanded') {
    // Expanded: show full numbers (321–328)
    return normalized
  }

  // Try to parse as numeric range
  const match = pages.match(/^(\d+)\s*[-\u2013]\s*(\d+)$/)
  if (!match) return normalized // Non-numeric range, pass through

  const first = match[1]
  const last = match[2]

  if (format === 'minimal') {
    return first + '\u2013' + minimalEnd(first, last, 1)
  }

  if (format === 'minimal-two') {
    return first + '\u2013' + minimalEnd(first, last, 2)
  }

  if (format === 'chicago') {
    return first + '\u2013' + chicagoEnd(first, last)
  }

  return normalized
}

/**
 * Minimal format: remove shared leading digits, keep at least `minDigits` digits.
 */
function minimalEnd(first, last, minDigits) {
  let i = 0
  while (i < first.length && i < last.length - minDigits && first[i] === last[i]) {
    i++
  }
  return last.slice(i)
}

/**
 * Chicago page range algorithm (16th ed. 9.64):
 * - 1-99: use all digits (3-10, 71-72, 96-117)
 * - 100+: if second number ≤ 109 (in its hundred), use changed part only (100-104 → 100-104)
 * - For x01-x09: use changed part only (1496-1504 → 1496–504)
 * - Otherwise: use at least 2 digits (321-328 → 321–28, 1087-1089 → 1087–89)
 */
function chicagoEnd(first, last) {
  const f = parseInt(first, 10)
  const l = parseInt(last, 10)

  // Less than 100: use all digits
  if (f < 100) return last

  // 100s: if both in same hundred and last ends in 00-09, use all digits
  const fHundred = Math.floor(f / 100)
  const lHundred = Math.floor(l / 100)
  if (fHundred === lHundred && (l % 100) >= 0 && (l % 100) <= 9) {
    return last
  }

  // Use at least 2 digits
  return minimalEnd(first, last, 2)
}
