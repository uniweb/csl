/**
 * @citestyle/registry
 *
 * Runtime citation state manager. Tracks citations across a document
 * for features that require cross-reference knowledge:
 *
 * - Year-suffix assignment (2024a, 2024b)
 * - Citation number tracking (numeric styles)
 * - Bibliography sorting (using compiled comparator)
 * - Subsequent-author-substitute
 *
 * Also provides simple format/formatAll/formatCitation helpers for
 * one-off formatting without a full registry.
 */

export { createRegistry } from './registry.js'
export { format, formatAll, formatCitation } from './format.js'
