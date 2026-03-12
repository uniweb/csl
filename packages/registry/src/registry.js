/**
 * Citation registry — tracks cross-citation state for a compiled style.
 *
 * Features:
 * - Citation-number assignment (for numeric styles like IEEE, Vancouver)
 * - Bibliography sorting (using compiled sort comparator)
 * - Subsequent-author-substitute (em-dash for repeated authors in bibliography)
 * - Year-suffix disambiguation (a, b, c for same author+year)
 * - Name disambiguation (add-givenname, add-names)
 * - Cite collapsing (numeric ranges, author-date year grouping)
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

  /** @type {Map<string, object>} - Per-item disambiguation state */
  const disambigState = new Map()

  /** Whether disambiguation has been computed */
  let disambigDirty = true

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
        disambigDirty = true
      } else {
        // Update existing item
        itemsById.set(id, item)
        item['citation-number'] = citationNumbers.get(id)
        disambigDirty = true
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
   * Ensure disambiguation and year-suffixes are computed.
   */
  function ensureDisambiguated() {
    if (!disambigDirty) return
    disambigDirty = false
    runDisambiguation()
    assignYearSuffixes()
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

    ensureDisambiguated()

    const resolvedCites = cites.map(c => {
      const item = c.item || itemsById.get(String(c.id))
      if (!item) {
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

      // Attach per-item disambiguation overrides
      const disambig = disambigState.get(String(item.id))
      if (disambig) citeObj._disambig = disambig

      return citeObj
    })

    // Apply cite collapsing
    const collapse = style.meta?.collapse
    if (collapse === 'citation-number' && resolvedCites.length > 1) {
      return collapseNumericCitation(resolvedCites, ctx)
    }
    if ((collapse === 'year' || collapse === 'year-suffix' || collapse === 'year-suffix-ranged') && resolvedCites.length > 1) {
      return collapseAuthorDateCitation(resolvedCites, ctx, collapse)
    }

    return style.citation(resolvedCites, ctx)
  }

  // ── Numeric cite collapsing ──────────────────────────────────────────────

  /**
   * Collapse numeric citations into ranges.
   * [1, 2, 3, 5] → [1–3, 5]
   */
  function collapseNumericCitation(resolvedCites, ctx) {
    const sorted = [...resolvedCites].sort((a, b) =>
      (a.item['citation-number'] || 0) - (b.item['citation-number'] || 0)
    )

    const numbers = sorted.map(c => c.item['citation-number'] || 0)
    const hasLocators = sorted.some(c => c.locator != null)

    if (hasLocators) {
      return style.citation(sorted, ctx)
    }

    const ranges = []
    let rangeStart = numbers[0]
    let rangeEnd = numbers[0]

    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] === rangeEnd + 1) {
        rangeEnd = numbers[i]
      } else {
        ranges.push([rangeStart, rangeEnd])
        rangeStart = numbers[i]
        rangeEnd = numbers[i]
      }
    }
    ranges.push([rangeStart, rangeEnd])

    const hasCollapsible = ranges.some(([s, e]) => e - s >= 2)
    if (!hasCollapsible) {
      return style.citation(sorted, ctx)
    }

    const singleResult = style.citation([sorted[0]], ctx)
    const singleNum = String(numbers[0])

    const textIdx = singleResult.text.indexOf(singleNum)
    const textPrefix = textIdx >= 0 ? singleResult.text.slice(0, textIdx) : ''
    const textSuffix = textIdx >= 0 ? singleResult.text.slice(textIdx + singleNum.length) : ''

    const delimiter = style.meta?.citationLayoutDelimiter || ', '
    const rangeStrs = ranges.map(([s, e]) => {
      if (s === e) return String(s)
      if (e - s === 1) return `${s}${delimiter}${e}`
      return `${s}\u2013${e}`
    })
    const collapsedText = textPrefix + rangeStrs.join(delimiter) + textSuffix

    const htmlPrefix = singleResult.html.includes('<sup>')
      ? '<span class="csl-citation"><sup>' : '<span class="csl-citation">'
    const htmlSuffix = singleResult.html.includes('</sup>')
      ? '</sup></span>' : '</span>'
    const innerHtml = singleResult.html
      .replace(/<span class="csl-citation">/, '')
      .replace(/<\/span>$/, '')
      .replace(/<sup>/, '')
      .replace(/<\/sup>/, '')
    const htmlNumIdx = innerHtml.indexOf(singleNum)
    const htmlInnerPrefix = htmlNumIdx >= 0 ? innerHtml.slice(0, htmlNumIdx) : ''
    const htmlInnerSuffix = htmlNumIdx >= 0 ? innerHtml.slice(htmlNumIdx + singleNum.length) : ''

    const collapsedHtml = htmlPrefix + htmlInnerPrefix +
      rangeStrs.join(delimiter) + htmlInnerSuffix + htmlSuffix

    return { text: collapsedText, html: collapsedHtml }
  }

  // ── Author-date cite collapsing ──────────────────────────────────────────

  /**
   * Collapse author-date citations by grouping consecutive same-author cites.
   *
   * collapse="year":         (Smith, 2020, 2021; Jones, 2019)
   * collapse="year-suffix":  (Smith, 2020a, b; Jones, 2019)
   */
  function collapseAuthorDateCitation(resolvedCites, ctx, collapseMode) {
    const layoutDelim = style.meta?.citationLayoutDelimiter || '; '
    const layoutPrefix = style.meta?.citationLayoutPrefix || ''
    const layoutSuffix = style.meta?.citationLayoutSuffix || ''
    const citeGroupDelim = style.meta?.citeGroupDelimiter || ', '
    const yearSuffixDelim = style.meta?.yearSuffixDelimiter || citeGroupDelim
    const afterCollapseDelim = style.meta?.afterCollapseDelimiter || layoutDelim

    // Render each cite individually
    const citeData = resolvedCites.map(cite => {
      const result = style.citation([cite], ctx)
      // Strip layout prefix/suffix to get inner content
      let inner = result.text
      if (layoutPrefix && inner.startsWith(layoutPrefix)) inner = inner.slice(layoutPrefix.length)
      if (layoutSuffix && inner.endsWith(layoutSuffix)) inner = inner.slice(0, -layoutSuffix.length)

      const year = String(cite.item.issued?.['date-parts']?.[0]?.[0] || '')
      const yearSuffix = cite.item['year-suffix'] || ''

      return {
        cite,
        inner,
        authorKey: authorOnlyKey(cite.item),
        year,
        yearSuffix,
        yearStr: year + yearSuffix,
      }
    })

    // Group consecutive cites by author
    const authorGroups = []
    let currentGroup = [citeData[0]]
    for (let i = 1; i < citeData.length; i++) {
      if (citeData[i].authorKey && citeData[i].authorKey === currentGroup[0].authorKey) {
        currentGroup.push(citeData[i])
      } else {
        authorGroups.push(currentGroup)
        currentGroup = [citeData[i]]
      }
    }
    authorGroups.push(currentGroup)

    // Check if any group has >1 cite (otherwise no collapsing needed)
    const hasMultiCiteGroup = authorGroups.some(g => g.length > 1)
    if (!hasMultiCiteGroup) {
      return style.citation(resolvedCites, ctx)
    }

    // Build collapsed output
    const groupStrs = authorGroups.map(group => {
      if (group.length === 1) return group[0].inner

      const first = group[0]
      // Extract the author portion from the first cite's inner text
      // by finding where the year starts
      const yearIdx = first.inner.lastIndexOf(first.yearStr)
      if (yearIdx < 0) {
        // Can't find year — fall back to no collapsing for this group
        return group.map(c => c.inner).join(layoutDelim)
      }
      const authorPart = first.inner.slice(0, yearIdx)

      if (collapseMode === 'year-suffix' || collapseMode === 'year-suffix-ranged') {
        // Sub-group by year within this author group
        const yearSubgroups = []
        let currentYearGroup = [group[0]]
        for (let i = 1; i < group.length; i++) {
          if (group[i].year === currentYearGroup[0].year) {
            currentYearGroup.push(group[i])
          } else {
            yearSubgroups.push(currentYearGroup)
            currentYearGroup = [group[i]]
          }
        }
        yearSubgroups.push(currentYearGroup)

        const yearParts = yearSubgroups.map((yg, yi) => {
          if (yg.length === 1) {
            return yi === 0 ? yg[0].yearStr : yg[0].yearStr
          }
          // First cite shows full year+suffix, subsequent show suffix only
          const firstYearStr = yg[0].yearStr
          const suffixes = yg.slice(1).map(c => c.yearSuffix || c.yearStr)
          return firstYearStr + yearSuffixDelim + suffixes.join(yearSuffixDelim)
        })
        return authorPart + yearParts.join(citeGroupDelim)
      }

      // collapse="year": show first cite fully, subsequent show year+suffix
      const yearStrs = group.slice(1).map(c => c.yearStr)
      return authorPart + first.yearStr + citeGroupDelim + yearStrs.join(citeGroupDelim)
    })

    const innerText = groupStrs.join(afterCollapseDelim)
    const text = layoutPrefix + innerText + layoutSuffix

    // Build HTML: wrap in citation span, convert inner content to HTML
    const html = '<span class="csl-citation">' + escapeForHtml(text).replace(
      escapeForHtml(layoutPrefix),
      layoutPrefix ? escapeForHtml(layoutPrefix) : ''
    ) + '</span>'

    return { text, html }
  }

  // ── Name disambiguation ─────────────────────────────────────────────────

  /**
   * Run name disambiguation algorithm.
   *
   * 1. Render each item's citation with default settings
   * 2. Detect collisions (identical citation text for different items)
   * 3. Apply add-givenname (expand given names/initials)
   * 4. Apply add-names (show more names before et-al)
   * 5. Remaining collisions handled by year-suffix (separate step)
   */
  function runDisambiguation() {
    const addGivenname = style.meta?.disambiguateAddGivenname
    const addNames = style.meta?.disambiguateAddNames
    if (!addGivenname && !addNames) return
    if (!style.citation) return

    const rule = style.meta?.givennameDisambiguationRule || 'by-cite'

    // Clear previous state
    disambigState.clear()

    // Render each item's citation to detect collisions
    const renderings = new Map()
    for (const id of itemOrder) {
      const item = itemsById.get(id)
      if (!item) continue
      renderings.set(id, renderCiteSingle(id))
    }

    // Group by identical rendering
    const collisionGroups = groupByValue(renderings)

    // Process collision groups
    for (const ids of collisionGroups) {
      if (ids.length <= 1) continue

      // Step 1: Try add-givenname
      if (addGivenname) {
        applyGivennameDisambig(ids, rule)
      }

      // Step 2: Re-check and try add-names for still-colliding items
      if (addNames) {
        const newRenderings = new Map()
        for (const id of ids) {
          newRenderings.set(id, renderCiteSingle(id))
        }
        const stillColliding = groupByValue(newRenderings)
        for (const subIds of stillColliding) {
          if (subIds.length <= 1) continue
          applyAddNamesDisambig(subIds)
        }
      }
    }
  }

  /**
   * Render a single item's citation, applying any current disambiguation state.
   */
  function renderCiteSingle(id) {
    const item = itemsById.get(id)
    const disambig = disambigState.get(id)
    const cite = disambig ? { item, _disambig: disambig } : { item }
    return style.citation([cite]).text
  }

  /**
   * Group a Map<id, value> by identical values.
   * Returns arrays of ids that share the same value.
   */
  function groupByValue(map) {
    const groups = new Map()
    for (const [id, text] of map) {
      if (!groups.has(text)) groups.set(text, [])
      groups.get(text).push(id)
    }
    return [...groups.values()]
  }

  /**
   * Apply givenname disambiguation to a collision group.
   */
  function applyGivennameDisambig(ids, rule) {
    switch (rule) {
      case 'primary-name':
        for (const id of ids) {
          disambigState.set(id, { ...disambigState.get(id), expandIndices: [0] })
        }
        break
      case 'primary-name-with-initials':
        for (const id of ids) {
          disambigState.set(id, { ...disambigState.get(id), expandIndices: [0], withInitials: true })
        }
        break
      case 'all-names':
        for (const id of ids) {
          disambigState.set(id, { ...disambigState.get(id), expandAll: true })
        }
        break
      case 'all-names-with-initials':
        for (const id of ids) {
          disambigState.set(id, { ...disambigState.get(id), expandAll: true, withInitials: true })
        }
        break
      case 'by-cite':
        disambiguateProgressively(ids)
        break
    }
  }

  /**
   * Progressive disambiguation for by-cite rule.
   * Expand names one position at a time until citations are unique.
   */
  function disambiguateProgressively(ids) {
    const items = ids.map(id => itemsById.get(id))
    const maxNames = Math.max(...items.map(i => (i.author || i.editor || []).length))

    for (let expandCount = 1; expandCount <= maxNames; expandCount++) {
      const indices = Array.from({ length: expandCount }, (_, i) => i)

      for (const id of ids) {
        disambigState.set(id, { ...disambigState.get(id), expandIndices: indices })
      }

      // Check if resolved
      const renderings = new Map()
      for (const id of ids) {
        renderings.set(id, renderCiteSingle(id))
      }

      const groups = groupByValue(renderings)
      const stillColliding = groups.filter(g => g.length > 1)
      if (stillColliding.length === 0) break
    }
  }

  /**
   * Apply add-names disambiguation: increase et-al-use-first until
   * citations are unique or all names are shown.
   */
  function applyAddNamesDisambig(ids) {
    const items = ids.map(id => itemsById.get(id))
    const maxNames = Math.max(...items.map(i => (i.author || i.editor || []).length))

    for (let n = 2; n <= maxNames; n++) {
      for (const id of ids) {
        const existing = disambigState.get(id) || {}
        disambigState.set(id, { ...existing, etAlUseFirst: n, etAlMin: n + 1 })
      }

      const renderings = new Map()
      for (const id of ids) {
        renderings.set(id, renderCiteSingle(id))
      }

      const groups = groupByValue(renderings)
      const stillColliding = groups.filter(g => g.length > 1)
      if (stillColliding.length === 0) break
    }
  }

  // ── Year-suffix disambiguation ──────────────────────────────────────────

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

  // ── Bibliography ────────────────────────────────────────────────────────

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

    ensureDisambiguated()

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

// ── Helper functions ──────────────────────────────────────────────────────

/**
 * Apply subsequent-author-substitute to formatted bibliography entries.
 */
function applySubsequentAuthorSubstitute(entries, items, substitute) {
  if (entries.length < 2) return

  let prevAuthorKey = authorKey(items[0])

  for (let i = 1; i < entries.length; i++) {
    const key = authorKey(items[i])
    if (key && key === prevAuthorKey) {
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
 * Generate a key from author family names only (for collapsing).
 * Ignores given names — two items with the same family names collapse.
 */
function authorOnlyKey(item) {
  const names = item.author || item.editor || []
  if (!names.length) return ''
  return names.map(n => {
    if (n.literal) return n.literal
    const ndp = n['non-dropping-particle'] || ''
    const dp = n['dropping-particle'] || ''
    return [dp, ndp, n.family].filter(Boolean).join(' ')
  }).join(';')
}

/**
 * Replace the author portion in text output with the substitute string.
 */
function replaceAuthorInText(text, item, substitute) {
  const names = item.author || item.editor || []
  if (!names.length) return text

  const firstFamily = names[0].literal || names[0].family || ''
  if (!firstFamily) return text

  const idx = text.indexOf(firstFamily)
  if (idx < 0) return text

  const afterAuthor = text.indexOf('. (', idx)
  const afterAuthor2 = text.indexOf('. ', idx)
  const endIdx = afterAuthor >= 0 ? afterAuthor : afterAuthor2 >= 0 ? afterAuthor2 : -1
  if (endIdx < 0) return text

  return substitute + text.slice(endIdx)
}

/**
 * Replace the author portion in HTML output with the substitute string.
 */
function replaceAuthorInHtml(html, item, substitute) {
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
