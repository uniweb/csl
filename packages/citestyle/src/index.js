/**
 * citestyle — Citation formatting for the web
 *
 * Re-exports the core API from @citestyle/* packages.
 * Import styles separately: import * as apa from 'citestyle/styles/apa'
 */

// Registry — the primary API for most users
export { createRegistry, format, formatAll, formatCitation } from '@citestyle/registry'

// BibTeX import/export
export { parseBibtex, exportBibtex, convertLatex } from '@citestyle/bibtex'

// Core utilities (advanced usage)
export {
  formatNames,
  formatDate,
  titleCase,
  sentenceCase,
  capitalize,
  applyTextCase,
  stripNocaseSpans,
  ordinal,
  longOrdinal,
  roman,
  pageRange,
  escapeHtml,
  stripFormatting,
  toHtml,
  validateItem,
} from '@citestyle/core'
