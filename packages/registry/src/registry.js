/**
 * Citation registry — tracks cross-citation state for a compiled style.
 *
 * Features:
 * - Citation-number assignment (for numeric styles like IEEE, Vancouver)
 * - Bibliography sorting (using compiled sort comparator)
 * - Subsequent-author-substitute (em-dash for repeated authors in bibliography)
 * - Item lookup by ID
 *
 * @param {import('@citestyle/types').CompiledStyle} style - A compiled CSL style module
 * @param {object} [options]
 * @param {string} [options.subsequentAuthorSubstitute] - Override style's substitute string
 * @returns {import('@citestyle/types').Registry}
 */
export function createRegistry(style, options = {}) {
  if (!style || (!style.bibliography && !style.citation)) {
    throw new Error('createRegistry requires a compiled CSL style with bibliography() or citation()')
  }

  /** @type {Map<string, import('@citestyle/types').CslItem>} */
  const itemsById = new Map()

  /** @type {string[]} - Item IDs in insertion order */
  const itemOrder = []

  /** @type {Map<string, number>} - citation-number assignments (1-based) */
  const citationNumbers = new Map()

  /** Next citation number to assign */
  let nextCitNum = 1

  /**
   * Add items to the registry.
   * Items are stored by ID and assigned citation numbers in insertion order.
   *
   * @param {import('@citestyle/types').CslItem[]} items
   */
  function addItems(items) {
    for (const item of items) {
      const id = String(item.id)
      if (!itemsById.has(id)) {
        itemsById.set(id, item)
        itemOrder.push(id)
        citationNumbers.set(id, nextCitNum++)
        // Set citation-number on the item for numeric styles
        item['citation-number'] = citationNumbers.get(id)
      } else {
        // Update existing item
        itemsById.set(id, item)
        item['citation-number'] = citationNumbers.get(id)
      }
    }
  }

  /**
   * Get an item by ID.
   *
   * @param {string} id
   * @returns {import('@citestyle/types').CslItem | undefined}
   */
  function getItem(id) {
    return itemsById.get(String(id))
  }

  /**
   * Format a citation cluster.
   * Resolves item IDs to items and delegates to the compiled style's citation().
   *
   * @param {Array<{id: string, item?: object, locator?: string, label?: string, prefix?: string, suffix?: string}>} cites
   * @param {object} [ctx] - Format context
   * @returns {import('@citestyle/types').FormattedCitation}
   */
  function cite(cites, ctx = {}) {
    if (!style.citation) {
      return { text: '', html: '' }
    }

    // Ensure year-suffixes are assigned before formatting citations
    assignYearSuffixes()

    const resolvedCites = cites.map(c => {
      const item = c.item || itemsById.get(String(c.id))
      if (!item) {
        // Unknown item — add it on the fly if possible
        return { item: { id: c.id, type: 'article', title: '[missing]' } }
      }

      // Ensure citation-number is set
      if (!citationNumbers.has(String(item.id))) {
        addItems([item])
      }

      const citeObj = { item }
      if (c.locator != null) citeObj.locator = c.locator
      if (c.label != null) citeObj.label = c.label
      if (c.prefix != null) citeObj.prefix = c.prefix
      if (c.suffix != null) citeObj.suffix = c.suffix
      return citeObj
    })

    return style.citation(resolvedCites, ctx)
  }

  /**
   * Assign year-suffix letters (a, b, c, ...) to items that share the same
   * author+year combination. Sets `item['year-suffix']` on affected items.
   * Only active when the style has `disambiguate-add-year-suffix="true"`.
   */
  function assignYearSuffixes() {
    const useYearSuffix = style.meta?.disambiguateAddYearSuffix === true
    if (!useYearSuffix) return

    // Group items by author-year key
    const groups = new Map()
    for (const id of itemOrder) {
      const item = itemsById.get(id)
      if (!item) continue
      const key = authorYearKey(item)
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }

    // Assign suffixes to groups with >1 item
    for (const [, items] of groups) {
      if (items.length <= 1) {
        // Single item — clear any stale suffix
        delete items[0]['year-suffix']
        continue
      }
      for (let i = 0; i < items.length; i++) {
        items[i]['year-suffix'] = String.fromCharCode(97 + i) // a, b, c, ...
      }
    }
  }

  /**
   * Get the formatted bibliography.
   * Sorts items using the style's sort comparator, applies subsequent-author-substitute,
   * and returns FormattedEntry[] in bibliography order.
   *
   * @param {object} [ctx] - Format context
   * @returns {import('@citestyle/types').FormattedEntry[]}
   */
  function getBibliography(ctx = {}) {
    if (!style.bibliography) return []

    // Assign year-suffixes before formatting
    assignYearSuffixes()

    // Collect all items
    let items = itemOrder.map(id => itemsById.get(id)).filter(Boolean)

    // Sort if the style provides a comparator
    if (style.bibliographySort) {
      items = [...items].sort(style.bibliographySort)
    }

    // Format each item
    const entries = items.map(item => style.bibliography(item, ctx))

    // Apply subsequent-author-substitute if configured
    const subst = options.subsequentAuthorSubstitute ??
      style.meta?.subsequentAuthorSubstitute ?? null
    if (subst != null) {
      applySubsequentAuthorSubstitute(entries, items, subst)
    }

    return entries
  }

  return {
    addItems,
    getItem,
    cite,
    getBibliography,
    /** Number of items in the registry */
    get size() { return itemsById.size },
  }
}

/**
 * Apply subsequent-author-substitute to formatted bibliography entries.
 *
 * When consecutive entries have identical authors (comparing the raw author
 * names), the author portion of subsequent entries is replaced with the
 * substitute string (typically "———" or "---").
 *
 * This modifies entries in place.
 */
function applySubsequentAuthorSubstitute(entries, items, substitute) {
  if (entries.length < 2) return

  let prevAuthorKey = authorKey(items[0])

  for (let i = 1; i < entries.length; i++) {
    const key = authorKey(items[i])
    if (key && key === prevAuthorKey) {
      // Replace author portion in text and html
      entries[i] = {
        ...entries[i],
        text: replaceAuthorInText(entries[i].text, items[i], substitute),
        html: replaceAuthorInHtml(entries[i].html, items[i], substitute),
      }
    }
    prevAuthorKey = key
  }
}

/**
 * Generate a stable key for comparing authors across bibliography entries.
 */
function authorKey(item) {
  const names = item.author || item.editor || []
  if (!names.length) return ''
  return names.map(n => {
    if (n.literal) return n.literal
    return [n.family, n.given, n['non-dropping-particle'], n['dropping-particle']]
      .filter(Boolean).join('|')
  }).join(';')
}

/**
 * Replace the author portion in text output with the substitute string.
 * Heuristic: find the first occurrence of the author's family name and
 * replace everything up to the next structural separator.
 */
function replaceAuthorInText(text, item, substitute) {
  // Use the csl-author semantic span in HTML for precise replacement,
  // but for text we use a heuristic: the author appears at the start
  const names = item.author || item.editor || []
  if (!names.length) return text

  // Find where the author ends — look for the first date-like pattern or period after names
  // Simple heuristic: replace up to the first ". (" or ". " after the author
  const firstFamily = names[0].literal || names[0].family || ''
  if (!firstFamily) return text

  const idx = text.indexOf(firstFamily)
  if (idx < 0) return text

  // Find the end of the author section: look for ". (" or ". " which typically follows author names
  const afterAuthor = text.indexOf('. (', idx)
  const afterAuthor2 = text.indexOf('. ', idx)
  const endIdx = afterAuthor >= 0 ? afterAuthor : afterAuthor2 >= 0 ? afterAuthor2 : -1
  if (endIdx < 0) return text

  return substitute + text.slice(endIdx)
}

/**
 * Replace the author portion in HTML output with the substitute string.
 * Uses the csl-author semantic span for precise replacement.
 */
function replaceAuthorInHtml(html, item, substitute) {
  // Look for <span class="csl-author">...</span> and replace its content
  return html.replace(
    /<span class="csl-author">.*?<\/span>/,
    `<span class="csl-author">${escapeForHtml(substitute)}</span>`
  )
}

function escapeForHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Generate a key combining author names and year for year-suffix detection.
 * Two items with the same key would render identically in an author-date
 * citation without disambiguation.
 */
function authorYearKey(item) {
  const names = item.author || item.editor || []
  if (!names.length) return ''
  const nameStr = names.map(n => {
    if (n.literal) return n.literal
    return (n.family || '') + '|' + (n.given || '')
  }).join(';')
  const year = item.issued?.['date-parts']?.[0]?.[0]
  if (year == null) return ''
  return nameStr + '/' + year
}
