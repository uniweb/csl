/**
 * Simple formatting API — format items without a full registry.
 *
 * Use these for one-off formatting where you don't need cross-reference
 * features (year-suffix, citation numbering, disambiguation, collapsing).
 * For documents with multiple citations, use createRegistry() instead.
 */

/**
 * Format a single bibliography entry.
 *
 * @param {import('@citestyle/types').CompiledStyle} style - A compiled CSL style module
 * @param {import('@citestyle/types').CslItem} item - CSL-JSON item
 * @param {import('@citestyle/types').FormatContext} [ctx] - Optional format context
 * @returns {import('@citestyle/types').FormattedEntry}
 */
export function format(style, item, ctx = {}) {
  if (!style?.bibliography) {
    throw new Error('format() requires a compiled style with a bibliography() function')
  }
  return style.bibliography(item, ctx)
}

/**
 * Format multiple bibliography entries with basic sorting.
 *
 * Items are sorted using the style's sort comparator (if any) and assigned
 * citation numbers in order. Does NOT perform year-suffix disambiguation,
 * name disambiguation, or subsequent-author-substitute — use createRegistry()
 * for those features.
 *
 * @param {import('@citestyle/types').CompiledStyle} style - A compiled CSL style module
 * @param {import('@citestyle/types').CslItem[]} items - CSL-JSON items
 * @param {import('@citestyle/types').FormatContext} [ctx] - Optional format context
 * @returns {import('@citestyle/types').FormattedEntry[]}
 */
export function formatAll(style, items, ctx = {}) {
  if (!style?.bibliography) {
    throw new Error('formatAll() requires a compiled style with a bibliography() function')
  }
  let sorted = [...items]
  if (style.bibliographySort) {
    sorted.sort(style.bibliographySort)
  }
  // Assign citation numbers
  sorted.forEach((item, i) => {
    item['citation-number'] = i + 1
  })
  return sorted.map(item => style.bibliography(item, ctx))
}

/**
 * Format a single inline citation.
 *
 * @param {import('@citestyle/types').CompiledStyle} style - A compiled CSL style module
 * @param {import('@citestyle/types').CiteRef[]} cites - Citation references with items
 * @param {import('@citestyle/types').FormatContext} [ctx] - Optional format context
 * @returns {import('@citestyle/types').FormattedCitation}
 */
export function formatCitation(style, cites, ctx = {}) {
  if (!style?.citation) {
    throw new Error('formatCitation() requires a compiled style with a citation() function')
  }
  // Assign citation numbers if not already set
  cites.forEach((cite, i) => {
    if (cite.item && cite.item['citation-number'] == null) {
      cite.item['citation-number'] = i + 1
    }
  })
  return style.citation(cites, ctx)
}
