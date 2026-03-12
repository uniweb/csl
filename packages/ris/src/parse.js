/**
 * Parse a RIS string into an array of CSL-JSON items.
 *
 * RIS is a tagged format with TY (type) / ER (end) delimiters.
 * Each tag is 2 uppercase letters followed by "  - " and a value.
 * Common in database exports (PubMed, Scopus, Web of Science).
 *
 * @param {string} ris - RIS source
 * @returns {object[]} Array of CSL-JSON items
 */

// ── RIS type → CSL type mapping ────────────────────────────────────────────

const TYPE_MAP = {
  ABST: 'article',
  ADVS: 'motion_picture',
  ART: 'graphic',
  BILL: 'bill',
  BOOK: 'book',
  CASE: 'legal_case',
  CHAP: 'chapter',
  COMP: 'software',
  CONF: 'paper-conference',
  CTLG: 'book',
  DATA: 'dataset',
  EDBOOK: 'book',
  EJOUR: 'article-journal',
  ELEC: 'webpage',
  GEN: 'article',
  HEAR: 'legal_case',
  ICOMM: 'personal_communication',
  INPR: 'article-journal',
  JOUR: 'article-journal',
  JFULL: 'article-journal',
  MAP: 'map',
  MGZN: 'article-magazine',
  MPCT: 'motion_picture',
  MUSIC: 'song',
  NEWS: 'article-newspaper',
  PAMP: 'pamphlet',
  PAT: 'patent',
  PCOMM: 'personal_communication',
  RPRT: 'report',
  SER: 'article',
  SLIDE: 'graphic',
  SOUND: 'song',
  STAND: 'legislation',
  STAT: 'legislation',
  THES: 'thesis',
  UNPB: 'manuscript',
  VIDEO: 'motion_picture',
}

// ── Name parsing ────────────────────────────────────────────────────────────

function parseName(str) {
  if (!str) return null
  str = str.trim()

  // "Last, First Suffix" or "Last, First, Suffix"
  const parts = str.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    const result = { family: parts[0] }
    // Check if third part is a suffix
    if (parts.length >= 3) {
      result.given = parts[1]
      result.suffix = parts[2]
    } else {
      result.given = parts[1]
    }
    return result
  }

  // Single name (corporate author)
  return { literal: str }
}

// ── Date parsing ────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null
  str = str.trim()

  // Common formats: YYYY, YYYY/MM/DD, YYYY/MM, YYYY/MM/DD/other
  const parts = str.split('/')
  const year = parseInt(parts[0], 10)
  if (isNaN(year)) return null

  const dateParts = [year]
  if (parts[1]) {
    const month = parseInt(parts[1], 10)
    if (!isNaN(month) && month >= 1 && month <= 12) {
      dateParts.push(month)
      if (parts[2]) {
        const day = parseInt(parts[2], 10)
        if (!isNaN(day) && day >= 1 && day <= 31) dateParts.push(day)
      }
    }
  }
  return { 'date-parts': [dateParts] }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseRis(ris) {
  if (!ris || typeof ris !== 'string') return []

  const items = []
  let current = null

  const lines = ris.split(/\r?\n/)

  for (const line of lines) {
    // RIS tag format: XX  - value (2 chars, 2 spaces, dash, space, value)
    const match = line.match(/^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/)
    if (!match) continue

    const [, tag, value] = match
    const val = value.trim()

    if (tag === 'TY') {
      current = { type: TYPE_MAP[val] || 'article', _raw: {} }
      continue
    }

    if (tag === 'ER') {
      if (current) {
        items.push(finalizeItem(current))
        current = null
      }
      continue
    }

    if (!current) continue

    // Accumulate tags (some are repeatable)
    if (!current._raw[tag]) current._raw[tag] = []
    current._raw[tag].push(val)
  }

  // Handle unterminated record
  if (current) items.push(finalizeItem(current))

  return items
}

function finalizeItem(record) {
  const raw = record._raw
  const item = { type: record.type }

  // ID
  item.id = first(raw.ID) || first(raw.AN) || `ris-${Date.now()}`

  // Authors (AU/A1 are primary authors)
  const authors = [...(raw.AU || []), ...(raw.A1 || [])]
  if (authors.length) item.author = authors.map(parseName).filter(Boolean)

  // Editors (A2/ED)
  const editors = [...(raw.A2 || []), ...(raw.ED || [])]
  if (editors.length) item.editor = editors.map(parseName).filter(Boolean)

  // Title
  item.title = first(raw.TI) || first(raw.T1) || ''

  // Container title
  const container = first(raw.T2) || first(raw.JO) || first(raw.JF) || first(raw.JA) || first(raw.J2)
  if (container) item['container-title'] = container

  // Abstract
  const abstract = first(raw.AB) || first(raw.N2)
  if (abstract) item.abstract = abstract

  // Date
  const dateStr = first(raw.PY) || first(raw.Y1) || first(raw.DA)
  if (dateStr) {
    const d = parseDate(dateStr)
    if (d) item.issued = d
  }

  // Simple fields
  if (first(raw.VL)) item.volume = first(raw.VL)
  if (first(raw.IS)) item.issue = first(raw.IS)

  // Pages: SP (start) + EP (end)
  const sp = first(raw.SP)
  const ep = first(raw.EP)
  if (sp && ep) item.page = `${sp}–${ep}`
  else if (sp) item.page = sp

  if (first(raw.DO)) item.DOI = first(raw.DO)
  if (first(raw.UR)) item.URL = first(raw.UR)
  if (first(raw.SN)) item.ISSN = first(raw.SN)
  if (first(raw.PB)) item.publisher = first(raw.PB)
  if (first(raw.CY)) item['publisher-place'] = first(raw.CY)
  if (first(raw.ET)) item.edition = first(raw.ET)
  if (first(raw.LA)) item.language = first(raw.LA)

  // Keywords (repeatable)
  if (raw.KW && raw.KW.length) item.keyword = raw.KW.join(', ')

  // Notes
  const notes = [...(raw.N1 || []), ...(raw.RN || [])]
  if (notes.length) item.note = notes.join('; ')

  // Series
  if (first(raw.T3)) item['collection-title'] = first(raw.T3)

  return item
}

function first(arr) {
  return arr && arr.length ? arr[0] : null
}
