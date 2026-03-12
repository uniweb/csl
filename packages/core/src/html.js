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
