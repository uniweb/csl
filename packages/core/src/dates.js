/**
 * Date formatting engine.
 *
 * Handles: localized and non-localized date forms, date-part formatting,
 * date ranges, seasons.
 *
 * @param {import('@citestyle/types').CslDate} date
 * @param {object} config - Style-specific config baked in by compiler
 * @param {Array<{name: string, form?: string, prefix?: string, suffix?: string, rangeDelimiter?: string}>} [config.dateParts]
 *   - Date parts to render, in order
 * @param {object} [config.monthTerms] - Locale month terms { '1': 'January', ... }
 * @param {object} [config.seasonTerms] - Locale season terms { '1': 'Spring', ... }
 * @returns {string} Formatted date string
 */
export function formatDate(date, config = {}) {
  if (!date) return ''

  // Handle literal dates
  if (date.literal) return date.literal

  const parts = date['date-parts']
  if (!parts || !parts.length || !parts[0].length) return ''

  const {
    dateParts = [{ name: 'year' }],
    monthTerms = DEFAULT_MONTHS,
    seasonTerms = DEFAULT_SEASONS,
  } = config

  const dp = parts[0]
  const year = dp[0]
  const month = dp.length > 1 ? dp[1] : undefined
  const day = dp.length > 2 ? dp[2] : undefined

  // Check for date range (two date-parts arrays)
  const hasRange = parts.length > 1 && parts[1].length > 0
  const dp2 = hasRange ? parts[1] : null
  const year2 = dp2 ? dp2[0] : undefined
  const month2 = dp2 && dp2.length > 1 ? dp2[1] : undefined
  const day2 = dp2 && dp2.length > 2 ? dp2[2] : undefined

  // Format each requested date part
  const result = []
  for (const partCfg of dateParts) {
    const val = formatDatePart(partCfg, { year, month, day, date }, { monthTerms, seasonTerms })
    if (val === '') continue

    let out = val
    if (hasRange) {
      const val2 = formatDatePart(partCfg, {
        year: year2, month: month2, day: day2, date,
      }, { monthTerms, seasonTerms })
      if (val2 && val2 !== val) {
        const rangeDelim = partCfg.rangeDelimiter || '\u2013'
        out = val + rangeDelim + val2
      }
    }

    if (partCfg.prefix) out = partCfg.prefix + out
    if (partCfg.suffix) out = out + partCfg.suffix
    result.push(out)
  }

  return result.join('')
}

/**
 * Format a single date part.
 */
function formatDatePart(cfg, vals, terms) {
  const { name, form } = cfg
  const { year, month, day, date } = vals

  if (name === 'year') {
    if (year == null) return ''
    let y = String(year)
    if (form === 'short') {
      y = y.slice(-2)
    }
    return y
  }

  if (name === 'month') {
    if (date && date.season) {
      return terms.seasonTerms[String(date.season)] || ''
    }
    if (month == null) return ''
    if (form === 'numeric') return String(month)
    if (form === 'numeric-leading-zeros') return String(month).padStart(2, '0')
    if (form === 'short') return (terms.monthTerms[String(month)] || '').slice(0, 3)
    // Default: long form
    return terms.monthTerms[String(month)] || ''
  }

  if (name === 'day') {
    if (day == null) return ''
    if (form === 'numeric-leading-zeros') return String(day).padStart(2, '0')
    if (form === 'ordinal') return ordinalDay(day)
    return String(day)
  }

  return ''
}

function ordinalDay(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const DEFAULT_MONTHS = {
  '1': 'January', '2': 'February', '3': 'March', '4': 'April',
  '5': 'May', '6': 'June', '7': 'July', '8': 'August',
  '9': 'September', '10': 'October', '11': 'November', '12': 'December',
}

const DEFAULT_SEASONS = {
  '1': 'Spring', '2': 'Summer', '3': 'Autumn', '4': 'Winter',
}
