/**
 * @citestyle/core
 *
 * Shared runtime helpers imported by all compiled CSL styles.
 * Keeps individual style modules small (~3-5KB) by centralizing
 * complex formatting logic here (~6-8KB shared).
 */

export { formatNames } from './names.js'
export { formatDate } from './dates.js'
export { titleCase, sentenceCase, capitalize, applyTextCase, stripNocaseSpans } from './text.js'
export { ordinal, longOrdinal, roman } from './numbers.js'
export { pageRange } from './pages.js'
export { escapeHtml, stripFormatting, toHtml } from './html.js'
