/**
 * Text-case transforms.
 *
 * CSL text-case values: lowercase, uppercase, capitalize-first,
 * capitalize-all, title, sentence.
 *
 * Nocase span support: CSL-JSON values may contain
 * `<span class="nocase">...</span>` to protect text from case transforms.
 * Protected regions are preserved as-is during transformation, then the
 * span tags are stripped from the final output. Protected regions may
 * contain PUA formatting tokens (U+E000-E007, U+E020-E022).
 */

// Regex to split on nocase spans — captures the protected content
const NOCASE_RE = /<span class="nocase">([\s\S]*?)<\/span>/g

/**
 * Apply a case transform while respecting nocase spans.
 * Splits the string on nocase boundaries, applies the transform to
 * unprotected segments only, then joins everything back together.
 *
 * @param {string} str - Input string (may contain nocase spans)
 * @param {function} transform - Case transform function for unprotected text
 * @returns {string} Transformed string with nocase spans stripped
 */
function withNocaseProtection(str, transform) {
  if (!str) return ''
  if (!str.includes('<span class="nocase">')) return transform(str)

  const parts = []
  let lastIndex = 0
  let match
  const re = new RegExp(NOCASE_RE.source, 'g')

  while ((match = re.exec(str)) !== null) {
    // Unprotected text before this span
    if (match.index > lastIndex) {
      parts.push({ text: str.slice(lastIndex, match.index), protect: false })
    }
    // Protected content (strip the span tags, keep content)
    parts.push({ text: match[1], protect: true })
    lastIndex = re.lastIndex
  }

  // Remaining unprotected text after last span
  if (lastIndex < str.length) {
    parts.push({ text: str.slice(lastIndex), protect: false })
  }

  return parts.map(p => p.protect ? p.text : transform(p.text)).join('')
}

// Words that should not be capitalized in title case (unless first/last word)
const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'down', 'for', 'from',
  'in', 'into', 'nor', 'of', 'on', 'onto', 'or', 'over', 'so',
  'the', 'till', 'to', 'up', 'via', 'with', 'yet',
])

/**
 * Convert text to title case.
 * Capitalize all words except stop words (articles, prepositions, conjunctions).
 * Always capitalize first and last word.
 *
 * @param {string} str
 * @returns {string}
 */
export function titleCase(str) {
  if (!str) return ''
  if (!str.includes('<span class="nocase">')) return _titleCaseInner(str)

  // Nocase-aware title case: parse into segments (protected vs unprotected),
  // then process all words as a single sequence for correct first/last detection
  const segments = parseNocaseSegments(str)

  // Collect all word tokens across segments for first/last word detection
  const allWords = []
  for (const seg of segments) {
    const words = seg.text.split(/(\s+)/)
    for (const w of words) {
      if (w.trim()) allWords.push({ word: w, protect: seg.protect })
    }
  }

  const totalWords = allWords.length
  // Detect all-caps across full string (strip nocase spans for this check)
  const plainStr = str.replace(NOCASE_RE, '$1')
  const isAllCaps = plainStr === plainStr.toUpperCase() && /[a-zA-Z]/.test(plainStr)

  let globalWordIdx = 0
  return segments.map(seg => {
    if (seg.protect) {
      // Count protected words but don't transform them
      const words = seg.text.split(/(\s+)/)
      for (const w of words) { if (w.trim()) globalWordIdx++ }
      return seg.text
    }

    const words = seg.text.split(/(\s+)/)
    return words.map(word => {
      if (!word.trim()) return word
      globalWordIdx++

      if (/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/.test(word)) return word
      if (/^[A-Z]{2,}$/.test(word) && !isAllCaps) return word

      if (globalWordIdx === 1 || globalWordIdx === totalWords) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      if (TITLE_STOP_WORDS.has(word.toLowerCase())) {
        return word.toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }).join('')
  }).join('')
}

function _titleCaseInner(str) {
  if (!str) return ''
  const words = str.split(/(\s+)/)
  let wordIndex = 0
  const totalWords = words.filter(w => w.trim()).length
  // Detect if the entire string is all-caps (then individual all-caps words aren't abbreviations)
  const isAllCaps = str === str.toUpperCase() && /[a-zA-Z]/.test(str)

  return words
    .map(word => {
      if (!word.trim()) return word // preserve whitespace
      wordIndex++

      // CSL spec: words with internal capitals (e.g., "OpenAI", "JavaScript")
      // or all-caps words in a mixed-case string are treated as intentional
      // casing and preserved as-is.
      if (/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/.test(word)) return word
      // Preserve all-caps words (2+ chars) when the whole string isn't all-caps
      if (/^[A-Z]{2,}$/.test(word) && !isAllCaps) return word

      // Always capitalize first and last word
      if (wordIndex === 1 || wordIndex === totalWords) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      // Don't capitalize stop words
      if (TITLE_STOP_WORDS.has(word.toLowerCase())) {
        return word.toLowerCase()
      }
      // Capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

/**
 * Parse a string into nocase-protected and unprotected segments.
 */
function parseNocaseSegments(str) {
  const parts = []
  let lastIndex = 0
  let match
  const re = new RegExp(NOCASE_RE.source, 'g')
  while ((match = re.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: str.slice(lastIndex, match.index), protect: false })
    }
    parts.push({ text: match[1], protect: true })
    lastIndex = re.lastIndex
  }
  if (lastIndex < str.length) {
    parts.push({ text: str.slice(lastIndex), protect: false })
  }
  return parts
}

/**
 * Convert text to sentence case.
 * Lowercase all words except the first word and proper nouns.
 * (We can't reliably detect proper nouns, so we only capitalize
 * the first word and words after ": ".)
 *
 * @param {string} str
 * @returns {string}
 */
export function sentenceCase(str) {
  if (!str) return ''
  if (!str.includes('<span class="nocase">')) return _sentenceCaseInner(str)

  // Nocase-aware: parse into segments, process as single sequence
  const segments = parseNocaseSegments(str)
  // Detect all-caps from unprotected segments only (nocase content shouldn't affect detection)
  const unprotectedText = segments.filter(s => !s.protect).map(s => s.text).join('')
  const isAllCaps = unprotectedText === unprotectedText.toUpperCase() && /[a-zA-Z]/.test(unprotectedText)

  let globalWordIdx = 0
  let afterColon = false
  return segments.map(seg => {
    if (seg.protect) {
      // Count words in protected segments but don't transform
      const words = seg.text.split(/(\s+)/)
      for (const w of words) {
        if (w.trim()) {
          globalWordIdx++
          afterColon = w.endsWith(':')
        }
      }
      return seg.text
    }

    const words = seg.text.split(/(\s+)/)
    return words.map(word => {
      if (!word.trim()) return word
      globalWordIdx++

      // First word or after colon: capitalize
      if (globalWordIdx === 1 || afterColon) {
        afterColon = word.endsWith(':')
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }

      if (word.endsWith(':')) afterColon = true

      // Preserve all-caps acronyms when string isn't entirely uppercase
      if (/^[A-Z]{2,}$/.test(word) && !isAllCaps) return word
      // Preserve mixed-case words
      if (/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/.test(word)) return word

      return word.toLowerCase()
    }).join('')
  }).join('')
}

function _sentenceCaseInner(str) {
  if (!str) return ''
  const isAllCaps = str === str.toUpperCase() && /[a-zA-Z]/.test(str)
  const words = str.split(/(\s+)/)
  let wordIndex = 0
  let afterColon = false

  const result = words.map(word => {
    if (!word.trim()) return word
    wordIndex++

    // Preserve all-caps words (acronyms) when string isn't entirely uppercase
    if (/^[A-Z]{2,}$/.test(word) && !isAllCaps && wordIndex > 1) return word
    // Preserve mixed-case words (e.g., "iPhone", "McDonald")
    if (/[a-z][A-Z]|[A-Z][a-z].*[A-Z]/.test(word) && wordIndex > 1) return word

    // First word or after colon: capitalize
    if (wordIndex === 1 || afterColon) {
      afterColon = false
      // First word all-caps in non-all-caps string: capitalize normally
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    }

    if (word.endsWith(':')) {
      afterColon = true
    }

    return word.toLowerCase()
  }).join('')

  return result
}

/**
 * Capitalize first character of string.
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  return withNocaseProtection(str, _capitalizeInner)
}

function _capitalizeInner(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Apply any CSL text-case transform with nocase protection.
 * This is the single entry point used by compiled styles — routes to
 * the appropriate transform function with nocase span handling.
 *
 * @param {string} str - Input string (may contain nocase spans)
 * @param {string} textCase - CSL text-case value
 * @returns {string}
 */
export function applyTextCase(str, textCase) {
  if (!str || !textCase) return str || ''
  switch (textCase) {
    case 'lowercase': return withNocaseProtection(str, s => s.toLowerCase())
    case 'uppercase': return withNocaseProtection(str, s => s.toUpperCase())
    case 'capitalize-first': return capitalize(str)
    case 'capitalize-all': return withNocaseProtection(str, s => s.split(' ').map(w => _capitalizeInner(w)).join(' '))
    case 'title': return titleCase(str)
    case 'sentence': return sentenceCase(str)
    default: return str
  }
}

/**
 * Strip nocase spans from a string without applying any case transform.
 * Used for values that pass through without text-case but may contain
 * nocase spans from CSL-JSON input.
 *
 * @param {string} str
 * @returns {string}
 */
export function stripNocaseSpans(str) {
  if (!str || typeof str !== 'string') return str || ''
  return str.replace(NOCASE_RE, '$1')
}
