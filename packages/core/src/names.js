/**
 * Name formatting engine.
 *
 * Handles: et-al truncation, delimiter-precedes-last, name-as-sort-order,
 * initialize-with, name particles (von, de la), name-part formatting,
 * substitute fallback chains.
 *
 * @param {import('@citestyle/types').CslName[]} names
 * @param {object} config - Style-specific config baked in by compiler
 * @param {string} [config.and] - 'text'|'symbol' → "and"|"&"
 * @param {string} [config.delimiter=', '] - Delimiter between names
 * @param {string} [config.delimiterPrecedesLast='contextual'] - 'contextual'|'always'|'never'|'after-inverted-name'
 * @param {number} [config.etAlMin] - Min names to trigger et-al
 * @param {number} [config.etAlUseFirst] - Names to show before et-al
 * @param {boolean} [config.etAlUseLast] - Show "…, & Last" pattern
 * @param {boolean} [config.initialize=true] - Abbreviate given names
 * @param {string} [config.initializeWith] - String after initials (e.g. '. ')
 * @param {string} [config.nameAsSortOrder] - 'first'|'all' → "Family, Given" ordering
 * @param {string} [config.sortSeparator=', '] - Separator in inverted names
 * @param {string} [config.andTerm='and'] - Resolved locale "and" term
 * @param {string} [config.etAlTerm='et al.'] - Resolved locale "et-al" term
 * @returns {string} Formatted name string
 */
export function formatNames(names, config = {}) {
  if (!names || !names.length) return ''

  const {
    and,
    delimiter = ', ',
    delimiterPrecedesLast = 'contextual',
    etAlMin,
    etAlUseFirst,
    etAlUseLast = false,
    initialize = true,
    initializeWith,
    nameAsSortOrder,
    sortSeparator = ', ',
    andTerm = 'and',
    etAlTerm = 'et al.',
    form = 'long',
  } = config

  // Determine if et-al truncation applies
  let truncated = false
  let displayNames = names
  if (etAlMin && etAlUseFirst && names.length >= etAlMin) {
    truncated = true
    if (etAlUseLast && names.length > etAlUseFirst + 1) {
      // Show first N, then "…", then last
      displayNames = [
        ...names.slice(0, etAlUseFirst),
        { _ellipsis: true },
        names[names.length - 1],
      ]
    } else {
      displayNames = names.slice(0, etAlUseFirst)
    }
  }

  // Handle form="count" — return number of names
  if (form === 'count') return String(displayNames.length)

  // Format individual names
  const formatted = displayNames.map((name, i) => {
    if (name._ellipsis) return '\u2026'

    // form="short" — family name only
    if (form === 'short') {
      if (name.literal) return name.literal
      return buildFamilyWithParticles(name)
    }

    return formatSingleName(name, {
      initialize,
      initializeWith,
      nameAsSortOrder,
      sortSeparator,
      index: i,
    })
  })

  // Join names with delimiters
  if (formatted.length === 0) return ''
  if (formatted.length === 1) {
    return formatted[0] + (truncated ? ' ' + etAlTerm : '')
  }

  // Handle et-al case (no "and" connector)
  if (truncated && !etAlUseLast) {
    return formatted.join(delimiter) + ' ' + etAlTerm
  }

  // Handle "…, & Last" pattern
  if (truncated && etAlUseLast) {
    // First N names + "…" + last name
    const parts = formatted.slice(0, -2)
    const ellipsis = formatted[formatted.length - 2] // "…"
    const last = formatted[formatted.length - 1]
    const andStr = and === 'symbol' ? '&' : andTerm
    return parts.join(delimiter) + delimiter + ellipsis + ' ' + andStr + ' ' + last
  }

  // Normal multi-name join
  const andStr = and === 'symbol' ? '&' : and === 'text' ? andTerm : null

  if (!andStr) {
    return formatted.join(delimiter)
  }

  if (formatted.length === 2) {
    // Two names: "A & B" or "A, & B"
    const useDelim = delimiterPrecedesLast === 'always' ||
      (delimiterPrecedesLast === 'after-inverted-name' && nameAsSortOrder)
    const sep = useDelim ? delimiter + andStr + ' ' : ' ' + andStr + ' '
    return formatted[0] + sep + formatted[1]
  }

  // Three or more names
  const init = formatted.slice(0, -1)
  const last = formatted[formatted.length - 1]

  const useDelimBeforeLast = delimiterPrecedesLast === 'always' ||
    delimiterPrecedesLast === 'after-inverted-name' ||
    (delimiterPrecedesLast === 'contextual' && formatted.length > 2)

  const sep = useDelimBeforeLast ? delimiter + andStr + ' ' : ' ' + andStr + ' '
  return init.join(delimiter) + sep + last
}

/**
 * Format a single name.
 */
function formatSingleName(name, opts) {
  const { initialize, initializeWith, nameAsSortOrder, sortSeparator = ', ', index } = opts

  // Literal names (institutional, etc.)
  if (name.literal) return name.literal

  const family = buildFamilyWithParticles(name)
  let given = name.given || ''

  // Initialize given names (e.g., "John Andrew" → "J. A.")
  // initializeWith can be "" (empty string) for styles like Vancouver → "JA"
  if (initialize && initializeWith != null && given) {
    given = initializeGiven(given, initializeWith)
  }

  if (!given) return family

  // Determine sort order (inverted: "Family, Given" vs. normal: "Given Family")
  const invert = nameAsSortOrder === 'all' ||
    (nameAsSortOrder === 'first' && index === 0)

  if (invert) {
    return family + sortSeparator + given
  }
  return given + ' ' + family
}

/**
 * Build family name with particles.
 * E.g., { family: 'Beethoven', 'non-dropping-particle': 'van' } → 'van Beethoven'
 */
function buildFamilyWithParticles(name) {
  let family = name.family || ''
  const ndp = name['non-dropping-particle']
  const dp = name['dropping-particle']
  const suffix = name.suffix

  if (ndp) family = ndp + ' ' + family
  if (dp) family = dp + ' ' + family
  if (suffix) family = family + ' ' + suffix

  return family
}

/**
 * Initialize given names.
 * "John Andrew" with ". " → "J. A."
 * "Jean-Pierre" with ". " → "J.-P."
 */
function initializeGiven(given, initWith) {
  const trimmedInit = initWith.trimEnd()
  // When initializeWith is empty (""), join initials without space (e.g., "JA")
  // When it has content (". "), join with space (e.g., "J. A.")
  const joinWith = initWith === '' ? '' : ' '

  return given
    .split(/\s+/)
    .filter(Boolean)
    .map(part => {
      // Handle hyphenated names: "Jean-Pierre" → "J.-P."
      if (part.includes('-')) {
        return part
          .split('-')
          .map(sub => sub ? sub.charAt(0).toUpperCase() + trimmedInit : '')
          .join('-')
      }
      return part.charAt(0).toUpperCase() + trimmedInit
    })
    .join(joinWith)
}
