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
 * Convert text to title case, as CSL 1.0.2 defines it: in a lowercase or mixed-case string,
 * capitalize the first character of each lowercase word and keep the case of every word that has
 * capitals of its own (an acronym such as "AI", a name such as "iPhone" or "LLMs"); in an
 * all-caps string, capitalize each word and lowercase the rest. Stop words (articles,
 * prepositions, conjunctions) are lowercase unless they are the first or the last word, or
 * follow a colon. Punctuation around a word ("AI:", "(and") is not part of it. Text inside
 * `<span class="nocase">` is kept as written and still counts for first and last.
 *
 * @param {string} str
 * @returns {string}
 */
export function titleCase(str) {
  if (!str) return ''
  const segments = str.includes('<span class="nocase">') ? parseNocaseSegments(str) : [{ text: str, protect: false }]
  const plainStr = str.replace(NOCASE_RE, '$1')
  // Detect all-caps across the full string (then its all-caps words are not acronyms)
  const isAllCaps = plainStr === plainStr.toUpperCase() && /\p{L}/u.test(plainStr)
  const totalWords = segments.reduce((n, seg) => n + seg.text.split(/\s+/).filter((w) => w.trim()).length, 0)

  let index = 0
  let afterColon = false
  return segments
    .map((seg) =>
      seg.text
        .split(/(\s+)/)
        .map((word) => {
          if (!word.trim()) return word
          index++
          const out = seg.protect
            ? word
            : titleCaseWord(word, { first: index === 1, last: index === totalWords, afterColon, isAllCaps })
          afterColon = ENDS_WITH_COLON.test(word)
          return out
        })
        .join('')
    )
    .join('')
}

/** A word's leading punctuation, the word, and its trailing punctuation (and formatting tokens). */
const WORD_PARTS = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su

/** A word that closes on a colon, maybe before formatting tokens: the next word starts a subtitle. */
const ENDS_WITH_COLON = /:[--]*$/

/**
 * One word of a title-cased string.
 *
 * @param {string} word - a word with any punctuation around it
 * @param {{ first: boolean, last: boolean, afterColon: boolean, isAllCaps: boolean }} at
 */
function titleCaseWord(word, { first, last, afterColon, isAllCaps }) {
  const [, pre, core, post] = word.match(WORD_PARTS)
  if (!core) return word
  const lower = core.toLowerCase()
  const stop = TITLE_STOP_WORDS.has(lower) && !first && !last && !afterColon
  if (isAllCaps) return pre + (stop ? lower : core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()) + post
  if (core === lower) return pre + (stop ? core : core.charAt(0).toUpperCase() + core.slice(1)) + post
  // A word with capitals of its own keeps them, save a stop word capitalized mid-title ("And")
  if (stop && core === core.charAt(0) + core.slice(1).toLowerCase()) return pre + lower + post
  return word
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
