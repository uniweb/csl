/**
 * Serialize CSL-JSON items as a BibTeX string.
 *
 * Produces clean, readable BibTeX with proper field ordering,
 * en-dash page ranges, and name formatting.
 *
 * @param {object[]} items - CSL-JSON items
 * @returns {string} BibTeX source
 */

// ── CSL type → BibTeX entry type mapping ────────────────────────────────────

const REVERSE_TYPE_MAP = {
  'article-journal': 'article',
  'article-magazine': 'article',
  'article-newspaper': 'article',
  'article': 'misc',
  'book': 'book',
  'chapter': 'incollection',
  'manuscript': 'unpublished',
  'pamphlet': 'booklet',
  'paper-conference': 'inproceedings',
  'report': 'techreport',
  'thesis': 'phdthesis',
  'webpage': 'misc',
  'motion_picture': 'misc',
  'graphic': 'misc',
  'song': 'misc',
  'software': 'misc',
  'dataset': 'misc',
  'patent': 'misc',
  'bill': 'misc',
  'legislation': 'misc',
  'legal_case': 'misc',
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// ── Name serialization ──────────────────────────────────────────────────────

function serializeName(name) {
  if (name.literal) return `{${name.literal}}`

  const parts = []
  // "von Last, Jr., First" format
  const particle = name['non-dropping-particle'] || name['dropping-particle'] || ''
  const family = (particle ? particle + ' ' : '') + (name.family || '')

  if (name.suffix) {
    // Last, Jr., First
    parts.push(family)
    parts.push(name.suffix)
    if (name.given) parts.push(name.given)
    return parts.join(', ')
  }

  if (name.given) {
    return `${family}, ${name.given}`
  }

  return family
}

function serializeNames(names) {
  if (!names || !names.length) return null
  return names.map(serializeName).join(' and ')
}

// ── Field value escaping ────────────────────────────────────────────────────

function escapeValue(str) {
  if (str == null) return null
  return String(str)
}

function wrapBraces(str) {
  return `{${str}}`
}

// ── Generate citation key ───────────────────────────────────────────────────

function generateKey(item) {
  if (item.id && typeof item.id === 'string' && !/\s/.test(item.id)) return item.id

  let key = ''
  if (item.author && item.author.length) {
    const first = item.author[0]
    key += (first.family || first.literal || 'unknown').replace(/\s+/g, '')
  }

  const year = item.issued?.['date-parts']?.[0]?.[0]
  if (year) key += year
  return key || 'item'
}

// ── Public API ──────────────────────────────────────────────────────────────

export function exportBibtex(items) {
  if (!items || !items.length) return ''

  return items.map(item => {
    let entryType = REVERSE_TYPE_MAP[item.type] || 'misc'

    // Refine thesis type
    if (item.type === 'thesis' && item.genre) {
      const genre = item.genre.toLowerCase()
      if (genre.includes('master')) entryType = 'mastersthesis'
      else entryType = 'phdthesis'
    }

    const key = generateKey(item)
    const fields = []

    // Names
    if (item.author) {
      const val = serializeNames(item.author)
      if (val) fields.push(['author', wrapBraces(val)])
    }
    if (item.editor) {
      const val = serializeNames(item.editor)
      if (val) fields.push(['editor', wrapBraces(val)])
    }

    // Title
    if (item.title) fields.push(['title', wrapBraces(escapeValue(item.title))])

    // Container title → journal or booktitle
    if (item['container-title']) {
      const bibField = entryType === 'article' ? 'journal' : 'booktitle'
      fields.push([bibField, wrapBraces(escapeValue(item['container-title']))])
    }

    // Date
    const dateParts = item.issued?.['date-parts']?.[0]
    if (dateParts) {
      if (dateParts[0]) fields.push(['year', wrapBraces(String(dateParts[0]))])
      if (dateParts[1] && dateParts[1] >= 1 && dateParts[1] <= 12) {
        fields.push(['month', MONTH_NAMES[dateParts[1] - 1]])
      }
    }

    // Simple fields
    const simpleFields = [
      ['volume', 'volume'],
      ['issue', 'number'],
      ['page', 'pages'],
      ['DOI', 'doi'],
      ['URL', 'url'],
      ['ISBN', 'isbn'],
      ['ISSN', 'issn'],
      ['publisher', 'publisher'],
      ['publisher-place', 'address'],
      ['edition', 'edition'],
      ['collection-title', 'series'],
      ['note', 'note'],
      ['abstract', 'abstract'],
      ['keyword', 'keywords'],
      ['language', 'language'],
      ['chapter-number', 'chapter'],
    ]

    for (const [cslField, bibField] of simpleFields) {
      if (item[cslField]) {
        let val = String(item[cslField])
        // Normalize page ranges: – → --
        if (bibField === 'pages') val = val.replace(/–/g, '--')
        fields.push([bibField, wrapBraces(val)])
      }
    }

    // Publisher from school/institution
    if (!item.publisher && entryType === 'phdthesis' || entryType === 'mastersthesis') {
      // Already handled above via publisher
    }

    // Genre for thesis
    if (item.genre && entryType !== 'phdthesis' && entryType !== 'mastersthesis') {
      fields.push(['type', wrapBraces(escapeValue(item.genre))])
    }

    // Format output
    const fieldStr = fields.map(([k, v]) => `  ${k} = ${v}`).join(',\n')
    return `@${entryType}{${key},\n${fieldStr}\n}`
  }).join('\n\n') + '\n'
}
