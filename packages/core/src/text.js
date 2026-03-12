/**
 * Text-case transforms.
 *
 * CSL text-case values: lowercase, uppercase, capitalize-first,
 * capitalize-all, title, sentence.
 */

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
  const words = str.split(/(\s+)/)
  let wordIndex = 0
  const totalWords = words.filter(w => w.trim()).length

  return words
    .map(word => {
      if (!word.trim()) return word // preserve whitespace
      wordIndex++
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
  // Lowercase everything
  let result = str.toLowerCase()
  // Capitalize first character
  result = result.charAt(0).toUpperCase() + result.slice(1)
  // Capitalize after colon+space
  result = result.replace(/: [a-z]/g, match => match.toUpperCase())
  return result
}

/**
 * Capitalize first character of string.
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Capitalize first letter of a word, preserving rest */
function capitalizeWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}
