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
 * @param {string} [config.delimiterPrecedesEtAl='contextual'] - 'contextual'|'always'|'never'|'after-inverted-name'
 * @param {number} [config.etAlMin] - Min names to trigger et-al
 * @param {number} [config.etAlUseFirst] - Names to show before et-al
 * @param {boolean} [config.etAlUseLast] - Show "…, Last" pattern (no "and")
 * @param {boolean} [config.initialize=true] - Abbreviate given names
 * @param {string} [config.initializeWith] - String after initials (e.g. '. ')
 * @param {string} [config.nameAsSortOrder] - 'first'|'all' → "Family, Given" ordering
 * @param {string} [config.sortSeparator=', '] - Separator in inverted names
 * @param {string} [config.andTerm='and'] - Resolved locale "and" term
 * @param {string} [config.etAlTerm='et al.'] - Resolved locale "et-al" term
 * @param {Array} [config.nameParts] - Per-part formatting [{name:'family', textCase:'uppercase', ...}]
 * @returns {string} Formatted name string
 */
export function formatNames(names, config = {}) {
  if (!names || !names.length) return ''

  const {
    and,
    delimiter = ', ',
    delimiterPrecedesLast = 'contextual',
    delimiterPrecedesEtAl = 'contextual',
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
    nameParts = [],
  } = config

  // Determine if et-al truncation applies
  let truncated = false
  let displayNames = names
  if (etAlMin && etAlUseFirst && names.length >= etAlMin) {
    truncated = true
    if (etAlUseLast && names.length > etAlUseFirst + 1) {
      // Show first N, then last (ellipsis added during join)
      displayNames = [
        ...names.slice(0, etAlUseFirst),
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
    // form="short" — family name only
    if (form === 'short') {
      if (name.literal) return name.literal
      let family = buildFamilyWithParticles(name)
      family = applyNamePartFormatting(family, 'family', nameParts)
      return family
    }

    return formatSingleName(name, {
      initialize,
      initializeWith,
      nameAsSortOrder,
      sortSeparator,
      index: i,
      nameParts,
    })
  })

  // Join names with delimiters
  if (formatted.length === 0) return ''
  if (formatted.length === 1 && !truncated) {
    return formatted[0]
  }

  // Handle et-al-use-last: "A, B, … Z" pattern (no "and" connector)
  if (truncated && etAlUseLast) {
    const init = formatted.slice(0, -1) // first N names
    const last = formatted[formatted.length - 1]
    return (init.length > 0 ? init.join(delimiter) + delimiter : '') + '\u2026 ' + last
  }

  // Handle et-al case (no "and" connector, just "et al." after names)
  if (truncated) {
    const joined = formatted.join(delimiter)
    // delimiter-precedes-et-al controls separator before "et al."
    const dpea = delimiterPrecedesEtAl || 'contextual'
    let useDelim
    if (dpea === 'always') useDelim = true
    else if (dpea === 'never') useDelim = false
    else if (dpea === 'after-inverted-name') useDelim = !!nameAsSortOrder
    else useDelim = formatted.length > 1 // contextual
    return joined + (useDelim ? delimiter : ' ') + etAlTerm
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
  const { initialize, initializeWith, nameAsSortOrder, sortSeparator = ', ', index, nameParts = [] } = opts

  // Literal names (institutional, etc.)
  if (name.literal) return name.literal

  let family = buildFamilyWithParticles(name)
  let given = name.given || ''

  // Initialize given names (e.g., "John Andrew" → "J. A.")
  // initializeWith can be "" (empty string) for styles like Vancouver → "JA"
  if (initialize && initializeWith != null && given) {
    given = initializeGiven(given, initializeWith)
  }

  // Apply name-part formatting (text-case, font formatting)
  family = applyNamePartFormatting(family, 'family', nameParts)
  given = applyNamePartFormatting(given, 'given', nameParts)

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
 * Apply name-part formatting (text-case and font formatting) to a name part.
 *
 * @param {string} str - The name part string
 * @param {string} partName - 'family' or 'given'
 * @param {Array} nameParts - Array of name-part configs
 * @returns {string} Formatted name part
 */
function applyNamePartFormatting(str, partName, nameParts) {
  if (!str || !nameParts || nameParts.length === 0) return str

  const cfg = nameParts.find(np => np.name === partName)
  if (!cfg) return str

  // Apply text-case
  if (cfg.textCase === 'uppercase') str = str.toUpperCase()
  else if (cfg.textCase === 'lowercase') str = str.toLowerCase()
  else if (cfg.textCase === 'capitalize-first') str = str.charAt(0).toUpperCase() + str.slice(1)
  else if (cfg.textCase === 'capitalize-all') str = str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  // Apply font formatting using PUA tokens
  if (cfg.fontStyle === 'italic') str = '\uE000' + str + '\uE001'
  if (cfg.fontWeight === 'bold') str = '\uE002' + str + '\uE003'
  if (cfg.fontVariant === 'small-caps') str = '\uE004' + str + '\uE005'

  return str
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
