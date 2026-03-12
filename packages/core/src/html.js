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
 *
 * Font formatting tokens (U+E000-E007):
 *   U+E000/E001 = italic start/end
 *   U+E002/E003 = bold start/end
 *   U+E004/E005 = small-caps start/end
 *   U+E006/E007 = underline start/end
 *
 * Semantic span tokens (U+E020-E022):
 *   U+E020 = semantic span start (followed by class name until U+E021)
 *   U+E021 = separator between class name and content
 *   U+E022 = semantic span end
 *
 * Example: \uE020title\uE021My Book Title\uE022
 *   → stripFormatting: "My Book Title"
 *   → toHtml: '<span class="csl-title">My Book Title</span>'
 */
const FMT_REGEX = /[\uE000-\uE007]/g
const SEM_OPEN_REGEX = /\uE020[^\uE021]*\uE021/g
const SEM_CLOSE = /\uE022/g

/**
 * Strip formatting tokens from text output.
 *
 * @param {string} str - Text with embedded formatting tokens
 * @returns {string} Clean plain text
 */
export function stripFormatting(str) {
  if (!str) return ''
  return str
    .replace(SEM_OPEN_REGEX, '')  // strip semantic open markers + class names
    .replace(FMT_REGEX, '')        // strip font formatting tokens
    .replace(SEM_CLOSE, '')        // strip semantic close markers
}

/**
 * Convert a formatted text string to semantic HTML.
 *
 * Processing order matters — auto-linking must happen while PUA tokens
 * are still in the string (before they become HTML tags that would
 * interfere with URL matching), then tokens are converted to HTML.
 *
 * 1. Escapes HTML entities (XSS protection)
 * 2. Auto-links DOI URLs (while PUA tokens still present)
 * 3. Auto-links other URLs (while PUA tokens still present)
 * 4. Converts formatting tokens to HTML tags (italic, bold, etc.)
 * 5. Converts semantic tokens to CSS-classed spans
 *
 * @param {string} str - Text with optional formatting tokens
 * @returns {string} HTML string
 */
export function toHtml(str) {
  if (!str) return ''

  // Escape HTML entities first (tokens are PUA chars, unaffected)
  let html = escapeHtml(str)

  // Auto-link DOI URLs (before token conversion — PUA chars used as URL boundaries)
  // The [^\s<)\uE000-\uE022] excludes PUA tokens from URL matching
  html = html.replace(
    /https:\/\/doi\.org\/[^\s<)\uE000-\uE022]+/g,
    match => {
      const cleaned = match.replace(/[.,;:]+$/, '')
      const trailing = match.slice(cleaned.length)
      return `<a class="csl-doi" href="${cleaned}">${cleaned}</a>${trailing}`
    }
  )

  // Auto-link bare DOIs (e.g., "doi:10.1038/nn.2024" or "doi: 10.1038/nn.2024")
  html = html.replace(
    /(?<!href="|">)doi:\s*(10\.[^\s<)\uE000-\uE022]+)/gi,
    (match, doi) => {
      const cleaned = doi.replace(/[.,;:]+$/, '')
      const trailing = doi.slice(cleaned.length)
      const prefix = match.slice(0, match.indexOf('10.'))
      return `${prefix}<a class="csl-doi" href="https://doi.org/${cleaned}">${cleaned}</a>${trailing}`
    }
  )

  // Auto-link remaining URLs (exclude PUA tokens from URL boundaries)
  html = html.replace(
    /(?<!href="|">)https?:\/\/[^\s<)\uE000-\uE022]+/g,
    match => {
      if (match.includes('doi.org/')) return match
      const cleaned = match.replace(/[.,;:]+$/, '')
      const trailing = match.slice(cleaned.length)
      return `<a class="csl-url" href="${cleaned}">${cleaned}</a>${trailing}`
    }
  )

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

  // Convert semantic span tokens to CSS-classed spans
  html = html.replace(/\uE020([^\uE021]*)\uE021/g, (_, cls) =>
    `<span class="csl-${cls}">`
  )
  html = html.replace(/\uE022/g, '</span>')

  return html
}
