/**
 * HTML escaping for safe output.
 *
 * Every variable interpolation in the structured HTML output must be
 * escaped to prevent XSS. This is the single function for that.
 *
 * @param {string} str - Raw string to escape
 * @returns {string} HTML-safe string
 */
export function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Formatting tokens — Unicode Private Use Area characters embedded in
 * text output by compiled styles to mark formatting spans. These are
 * invisible in plain text and get converted to HTML tags by toHtml().
 */
const FMT_ITALIC_START = '\uE000'
const FMT_ITALIC_END = '\uE001'
const FMT_BOLD_START = '\uE002'
const FMT_BOLD_END = '\uE003'
const FMT_SMALLCAPS_START = '\uE004'
const FMT_SMALLCAPS_END = '\uE005'
const FMT_UNDERLINE_START = '\uE006'
const FMT_UNDERLINE_END = '\uE007'

const FMT_REGEX = /[\uE000-\uE007]/g

/**
 * Strip formatting tokens from text output.
 *
 * @param {string} str - Text with embedded formatting tokens
 * @returns {string} Clean plain text
 */
export function stripFormatting(str) {
  if (!str) return ''
  return str.replace(FMT_REGEX, '')
}

/**
 * Convert a formatted text string to semantic HTML.
 *
 * 1. Escapes HTML entities (XSS protection)
 * 2. Converts formatting tokens to HTML tags (italic, bold, etc.)
 * 3. Auto-links DOI URLs
 * 4. Auto-links other URLs
 *
 * @param {string} str - Text with optional formatting tokens
 * @returns {string} HTML string
 */
export function toHtml(str) {
  if (!str) return ''

  // Escape HTML entities first (tokens are PUA chars, unaffected)
  let html = escapeHtml(str)

  // Convert formatting tokens to HTML tags
  html = html
    .replace(/\uE000/g, '<i>')
    .replace(/\uE001/g, '</i>')
    .replace(/\uE002/g, '<b>')
    .replace(/\uE003/g, '</b>')
    .replace(/\uE004/g, '<span class="csl-sc">')
    .replace(/\uE005/g, '</span>')
    .replace(/\uE006/g, '<span class="csl-ul">')
    .replace(/\uE007/g, '</span>')

  // Auto-link DOI URLs (must come before general URL linking)
  html = html.replace(
    /https:\/\/doi\.org\/[^\s<)]+/g,
    match => {
      // Strip trailing punctuation that isn't part of the DOI
      const cleaned = match.replace(/[.,;:]+$/, '')
      const trailing = match.slice(cleaned.length)
      return `<a class="csl-doi" href="${cleaned}">${cleaned}</a>${trailing}`
    }
  )

  // Auto-link remaining URLs (not already inside an <a> tag)
  html = html.replace(
    /(?<!href="|">)https?:\/\/[^\s<)]+/g,
    match => {
      // Skip if this URL was already linked as a DOI
      if (match.includes('doi.org/')) return match
      const cleaned = match.replace(/[.,;:]+$/, '')
      const trailing = match.slice(cleaned.length)
      return `<a class="csl-url" href="${cleaned}">${cleaned}</a>${trailing}`
    }
  )

  return html
}
