/**
 * Serialize CSL-JSON items as a RIS string.
 *
 * @param {object[]} items - CSL-JSON items
 * @returns {string} RIS source
 */

// ── CSL type → RIS type mapping ────────────────────────────────────────────

const REVERSE_TYPE_MAP = {
  'article-journal': 'JOUR',
  'article-magazine': 'MGZN',
  'article-newspaper': 'NEWS',
  'article': 'GEN',
  'book': 'BOOK',
  'chapter': 'CHAP',
  'dataset': 'DATA',
  'graphic': 'ART',
  'legal_case': 'CASE',
  'legislation': 'STAT',
  'manuscript': 'UNPB',
  'map': 'MAP',
  'motion_picture': 'MPCT',
  'pamphlet': 'PAMP',
  'paper-conference': 'CONF',
  'patent': 'PAT',
  'personal_communication': 'PCOMM',
  'report': 'RPRT',
  'software': 'COMP',
  'song': 'MUSIC',
  'thesis': 'THES',
  'webpage': 'ELEC',
}

// ── Name serialization ──────────────────────────────────────────────────────

function serializeName(name) {
  if (name.literal) return name.literal
  const parts = []
  const particle = name['non-dropping-particle'] || name['dropping-particle'] || ''
  const family = (particle ? particle + ' ' : '') + (name.family || '')
  parts.push(family)
  if (name.given) parts.push(name.given)
  if (name.suffix) parts.push(name.suffix)
  return parts.join(', ')
}

// ── Public API ──────────────────────────────────────────────────────────────

export function exportRis(items) {
  if (!items || !items.length) return ''

  return items.map(item => {
    const lines = []
    const tag = (t, v) => { if (v != null && v !== '') lines.push(`${t}  - ${v}`) }

    // Type
    tag('TY', REVERSE_TYPE_MAP[item.type] || 'GEN')

    // ID
    tag('ID', item.id)

    // Authors
    if (item.author) item.author.forEach(a => tag('AU', serializeName(a)))

    // Editors
    if (item.editor) item.editor.forEach(e => tag('A2', serializeName(e)))

    // Title
    tag('TI', item.title)

    // Container title
    if (item['container-title']) {
      const ct = item.type === 'article-journal' ? 'JO' : 'T2'
      tag(ct, item['container-title'])
    }

    // Abstract
    tag('AB', item.abstract)

    // Date
    const dateParts = item.issued?.['date-parts']?.[0]
    if (dateParts) {
      const parts = [String(dateParts[0])]
      if (dateParts[1]) parts.push(String(dateParts[1]).padStart(2, '0'))
      if (dateParts[2]) parts.push(String(dateParts[2]).padStart(2, '0'))
      tag('PY', parts.join('/'))
    }

    // Volume, issue
    tag('VL', item.volume)
    tag('IS', item.issue)

    // Pages
    if (item.page) {
      const pageParts = item.page.split(/[–-]/)
      tag('SP', pageParts[0].trim())
      if (pageParts[1]) tag('EP', pageParts[1].trim())
    }

    // Identifiers and links
    tag('DO', item.DOI)
    tag('UR', item.URL)
    tag('SN', item.ISSN || item.ISBN)

    // Publisher
    tag('PB', item.publisher)
    tag('CY', item['publisher-place'])

    // Other
    tag('ET', item.edition)
    tag('LA', item.language)
    if (item['collection-title']) tag('T3', item['collection-title'])

    // Keywords
    if (item.keyword) {
      item.keyword.split(/,\s*/).forEach(kw => tag('KW', kw.trim()))
    }

    // Notes
    tag('N1', item.note)

    // End record
    lines.push('ER  - ')
    return lines.join('\n')
  }).join('\n') + '\n'
}
