/**
 * Parse a BibTeX string into an array of CSL-JSON items.
 *
 * Handles: @article, @book, @inproceedings, @incollection, @inbook,
 * @phdthesis, @mastersthesis, @misc, @techreport, @unpublished,
 * @proceedings, @manual, @conference, @booklet, @online.
 *
 * Features: LaTeX accent/command conversion, @string abbreviations,
 * # concatenation, braced/quoted string values, month abbreviations.
 *
 * @param {string} bibtex - BibTeX source
 * @returns {object[]} Array of CSL-JSON items
 */

// ── LaTeX accent/command → Unicode mapping ──────────────────────────────────

const ACCENT_MAP = {
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È', I: 'Ì', O: 'Ò', U: 'Ù' },
  "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', Y: 'Ý', c: 'ć', n: 'ń', s: 'ś', z: 'ź', C: 'Ć', N: 'Ń', S: 'Ś', Z: 'Ź' },
  '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ', A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü', Y: 'Ÿ' },
  '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û', A: 'Â', E: 'Ê', I: 'Î', O: 'Ô', U: 'Û' },
  '~': { a: 'ã', n: 'ñ', o: 'õ', A: 'Ã', N: 'Ñ', O: 'Õ' },
  '=': { a: 'ā', e: 'ē', i: 'ī', o: 'ō', u: 'ū', A: 'Ā', E: 'Ē', I: 'Ī', O: 'Ō', U: 'Ū' },
  '.': { z: 'ż', Z: 'Ż', e: 'ė', I: 'İ' },
  'u': { a: 'ă', A: 'Ă', g: 'ğ', G: 'Ğ' },
  'v': { c: 'č', s: 'š', z: 'ž', r: 'ř', C: 'Č', S: 'Š', Z: 'Ž', R: 'Ř', e: 'ě', E: 'Ě', n: 'ň', N: 'Ň' },
  'c': { c: 'ç', C: 'Ç', s: 'ş', S: 'Ş', t: 'ţ', T: 'Ţ' },
  'H': { o: 'ő', u: 'ű', O: 'Ő', U: 'Ű' },
  'k': { a: 'ą', e: 'ę', A: 'Ą', E: 'Ę' },
  'd': { a: 'ạ', A: 'Ạ' },
}

const COMMAND_MAP = {
  'ss': 'ß', 'SS': 'SS',
  'o': 'ø', 'O': 'Ø',
  'ae': 'æ', 'AE': 'Æ',
  'oe': 'œ', 'OE': 'Œ',
  'aa': 'å', 'AA': 'Å',
  'l': 'ł', 'L': 'Ł',
  'i': 'ı', 'j': 'ȷ',
  'dh': 'ð', 'DH': 'Ð', 'dj': 'đ', 'DJ': 'Đ',
  'ng': 'ŋ', 'NG': 'Ŋ',
  'th': 'þ', 'TH': 'Þ',
  'textendash': '–', 'textemdash': '—',
  'textquotesingle': "'", 'textquotedblleft': '\u201C', 'textquotedblright': '\u201D',
  'textquoteleft': '\u2018', 'textquoteright': '\u2019',
  'textregistered': '®', 'textcopyright': '©', 'texttrademark': '™',
  'LaTeX': 'LaTeX', 'TeX': 'TeX', 'BibTeX': 'BibTeX',
}

const SYMBOL_ESCAPES = { '&': '&', '%': '%', '$': '$', '#': '#', '_': '_', '{': '{', '}': '}' }

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// ── Entry type → CSL type mapping ───────────────────────────────────────────

const TYPE_MAP = {
  article: 'article-journal',
  book: 'book',
  booklet: 'pamphlet',
  conference: 'paper-conference',
  inbook: 'chapter',
  incollection: 'chapter',
  inproceedings: 'paper-conference',
  manual: 'report',
  mastersthesis: 'thesis',
  misc: 'article',
  online: 'webpage',
  phdthesis: 'thesis',
  proceedings: 'book',
  techreport: 'report',
  unpublished: 'manuscript',
}

// ── LaTeX → Unicode conversion ──────────────────────────────────────────────

/**
 * Convert LaTeX accents and commands to Unicode.
 */
export function convertLatex(str) {
  if (!str) return str

  // Symbol escapes: \& \% \$ \# \_ \{ \}
  str = str.replace(/\\([&%$#_{}])/g, (_, ch) => SYMBOL_ESCAPES[ch] || ch)

  // Accented characters: \"{a} or \"a or \'{e} or \'e etc.
  // Pattern: \accent{letter} or \accent letter
  str = str.replace(/\\([`'"^~=.uvcHkd])\{([a-zA-Z])\}/g, (_, accent, letter) => {
    return ACCENT_MAP[accent]?.[letter] ?? `${accent}${letter}`
  })
  str = str.replace(/\\([`'"^~])\{\\([ij])\}/g, (_, accent, letter) => {
    const base = COMMAND_MAP[letter] || letter
    return ACCENT_MAP[accent]?.[base] ?? `${accent}${base}`
  })
  str = str.replace(/\\([`'"^~])([a-zA-Z])/g, (_, accent, letter) => {
    return ACCENT_MAP[accent]?.[letter] ?? `${accent}${letter}`
  })
  // Multi-char accent commands: \v{c}, \c{c}, \H{o}, \u{a}, \k{a}, \d{a}, \={a}, \.{z}
  str = str.replace(/\\([uvcHkd=.])\{([a-zA-Z])\}/g, (_, accent, letter) => {
    return ACCENT_MAP[accent]?.[letter] ?? `${accent}${letter}`
  })

  // Named commands: \ss, \o, \ae, etc.
  // Match \command followed by {} or space or non-letter
  str = str.replace(/\\([a-zA-Z]+)\{\}/g, (_, cmd) => COMMAND_MAP[cmd] ?? `\\${cmd}`)
  str = str.replace(/\\([a-zA-Z]+)(?=[\s{},;.!?)]|$)/g, (_, cmd) => {
    if (COMMAND_MAP[cmd] != null) return COMMAND_MAP[cmd]
    // Skip unknown commands — leave as-is for round-trip safety
    return `\\${cmd}`
  })

  // \url{...} → just the URL
  str = str.replace(/\\url\{([^}]*)\}/g, '$1')

  // \emph{...} or \textit{...} → just the text
  str = str.replace(/\\(?:emph|textit|textbf|textsc|texttt)\{([^}]*)\}/g, '$1')

  // Remove remaining braces (from {DNA} → DNA)
  str = str.replace(/[{}]/g, '')

  // Normalize whitespace (preserve non-breaking spaces from ~)
  str = str.replace(/~/g, '\u00A0') // TeX non-breaking space
  str = str.replace(/[\t\n\r ]+/g, ' ').trim()

  return str
}

// ── BibTeX tokenizer/parser ─────────────────────────────────────────────────

/**
 * Parse BibTeX source into raw entries (before CSL conversion).
 * Returns { type, key, fields } objects and populates string abbreviations.
 */
function parseRawEntries(bibtex) {
  const strings = { ...MONTH_MAP } // pre-populate month abbreviations
  const entries = []
  let pos = 0

  function skipWhitespace() {
    while (pos < bibtex.length && /\s/.test(bibtex[pos])) pos++
  }

  function readBraced() {
    // pos is at opening {
    let depth = 1
    pos++ // skip {
    let result = ''
    while (pos < bibtex.length && depth > 0) {
      if (bibtex[pos] === '{') { depth++; result += '{' }
      else if (bibtex[pos] === '}') { depth--; if (depth > 0) result += '}' }
      else if (bibtex[pos] === '\\') {
        result += bibtex[pos]
        pos++
        if (pos < bibtex.length) result += bibtex[pos]
      }
      else result += bibtex[pos]
      pos++
    }
    return result
  }

  function readQuoted() {
    // pos is at opening "
    pos++ // skip "
    let result = ''
    while (pos < bibtex.length && bibtex[pos] !== '"') {
      if (bibtex[pos] === '{') {
        result += '{' + readBraced() + '}'
      } else if (bibtex[pos] === '\\') {
        result += bibtex[pos]
        pos++
        if (pos < bibtex.length) result += bibtex[pos]
        pos++
      } else {
        result += bibtex[pos]
        pos++
      }
    }
    if (pos < bibtex.length) pos++ // skip closing "
    return result
  }

  function readValue() {
    skipWhitespace()
    let value = ''

    while (pos < bibtex.length) {
      skipWhitespace()
      let part
      if (bibtex[pos] === '{') {
        part = readBraced()
      } else if (bibtex[pos] === '"') {
        part = readQuoted()
      } else {
        // Bare identifier or number
        let ident = ''
        while (pos < bibtex.length && /[a-zA-Z0-9_.-]/.test(bibtex[pos])) {
          ident += bibtex[pos]
          pos++
        }
        if (/^\d+$/.test(ident)) {
          part = ident
        } else {
          // String reference
          const key = ident.toLowerCase()
          part = strings[key] != null ? String(strings[key]) : ident
        }
      }
      value += part
      skipWhitespace()
      if (bibtex[pos] === '#') {
        pos++ // skip #
        continue
      }
      break
    }
    return value
  }

  function readEntryBody(delimiter) {
    const close = delimiter === '{' ? '}' : ')'
    skipWhitespace()

    // Read citation key
    let key = ''
    while (pos < bibtex.length && bibtex[pos] !== ',' && bibtex[pos] !== close && !(/\s/.test(bibtex[pos]))) {
      key += bibtex[pos]
      pos++
    }
    key = key.trim()
    skipWhitespace()
    if (bibtex[pos] === ',') pos++

    // Read fields
    const fields = {}
    while (pos < bibtex.length && bibtex[pos] !== close) {
      skipWhitespace()
      if (bibtex[pos] === close) break

      // Read field name
      let fieldName = ''
      while (pos < bibtex.length && bibtex[pos] !== '=' && bibtex[pos] !== close && !(/\s/.test(bibtex[pos]))) {
        fieldName += bibtex[pos]
        pos++
      }
      fieldName = fieldName.trim().toLowerCase()
      if (!fieldName || bibtex[pos] === close) break

      skipWhitespace()
      if (bibtex[pos] !== '=') break
      pos++ // skip =

      const value = readValue()
      fields[fieldName] = value

      skipWhitespace()
      if (bibtex[pos] === ',') pos++
    }

    if (bibtex[pos] === close) pos++

    return { key, fields }
  }

  // Main parse loop
  while (pos < bibtex.length) {
    // Find next @
    const atIdx = bibtex.indexOf('@', pos)
    if (atIdx === -1) break
    pos = atIdx + 1

    // Read entry type
    skipWhitespace()
    let entryType = ''
    while (pos < bibtex.length && /[a-zA-Z]/.test(bibtex[pos])) {
      entryType += bibtex[pos]
      pos++
    }
    entryType = entryType.toLowerCase()

    skipWhitespace()
    const delimiter = bibtex[pos]
    if (delimiter !== '{' && delimiter !== '(') continue
    pos++ // skip { or (
    const close = delimiter === '{' ? '}' : ')'

    if (entryType === 'comment') {
      // Skip to matching close
      let depth = 1
      while (pos < bibtex.length && depth > 0) {
        if (bibtex[pos] === delimiter) depth++
        else if (bibtex[pos] === close) depth--
        pos++
      }
      continue
    }

    if (entryType === 'preamble') {
      readValue()
      skipWhitespace()
      if (bibtex[pos] === close) pos++
      continue
    }

    if (entryType === 'string') {
      // @string{name = value}
      skipWhitespace()
      let name = ''
      while (pos < bibtex.length && bibtex[pos] !== '=' && !(/\s/.test(bibtex[pos]))) {
        name += bibtex[pos]
        pos++
      }
      name = name.trim().toLowerCase()
      skipWhitespace()
      if (bibtex[pos] === '=') pos++
      const value = readValue()
      strings[name] = value
      skipWhitespace()
      if (bibtex[pos] === close) pos++
      continue
    }

    // Regular entry
    const { key, fields } = readEntryBody(delimiter)
    entries.push({ type: entryType, key, fields })
  }

  return { entries, strings }
}

// ── BibTeX name parsing ─────────────────────────────────────────────────────

/**
 * Parse a BibTeX name string into CSL name objects.
 * Handles "Last, First" and "First Last" formats.
 * Corporate authors in double braces: {World Health Organization}
 */
function parseNames(nameStr) {
  if (!nameStr) return []

  // Split on " and " (case-insensitive, respecting braces)
  const nameList = splitOnAnd(nameStr)

  return nameList.map(name => {
    name = name.trim()
    if (!name) return null

    // Corporate author: starts and ends with braces
    if (name.startsWith('{') && name.endsWith('}')) {
      return { literal: convertLatex(name.slice(1, -1)) }
    }

    // Convert LaTeX in the name
    name = convertLatex(name)

    // Split on commas (respecting braces)
    const parts = splitRespectingBraces(name, ',').map(s => s.trim())

    if (parts.length >= 3) {
      // "von Last, Jr., First"
      const { particle, family } = extractParticle(parts[0])
      return clean({
        family,
        given: parts[2],
        suffix: parts[1],
        'non-dropping-particle': particle,
      })
    } else if (parts.length === 2) {
      // "von Last, First"
      const { particle, family } = extractParticle(parts[0])
      return clean({
        family,
        given: parts[1],
        'non-dropping-particle': particle,
      })
    } else {
      // "First von Last" format
      return parseFirstLast(name)
    }
  }).filter(Boolean)
}

function splitOnAnd(str) {
  const parts = []
  let depth = 0
  let current = ''

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') depth--

    if (depth === 0 && str.slice(i, i + 5).toLowerCase() === ' and ') {
      parts.push(current)
      current = ''
      i += 4
      continue
    }
    current += str[i]
  }
  parts.push(current)
  return parts
}

function splitRespectingBraces(str, sep) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of str) {
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (ch === sep && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

function extractParticle(str) {
  const words = str.trim().split(/\s+/)
  if (words.length <= 1) return { particle: null, family: str.trim() }

  // Find where particle (lowercase) ends and family (uppercase) starts
  let particleEnd = 0
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i][0] && words[i][0] === words[i][0].toLowerCase() && /[a-z]/.test(words[i][0])) {
      particleEnd = i + 1
    } else {
      break
    }
  }

  if (particleEnd === 0) {
    return { particle: null, family: str.trim() }
  }
  return {
    particle: words.slice(0, particleEnd).join(' '),
    family: words.slice(particleEnd).join(' '),
  }
}

function parseFirstLast(name) {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return { family: words[0] }

  // Find the first lowercase word — that starts the "von" particle
  // Everything before it is "First", everything from there to the last uppercase is "von Last"
  let vonStart = -1
  for (let i = 1; i < words.length - 1; i++) {
    if (words[i][0] && words[i][0] === words[i][0].toLowerCase() && /[a-z]/.test(words[i][0])) {
      vonStart = i
      break
    }
  }

  if (vonStart === -1) {
    // No particle: "First Middle Last"
    return {
      given: words.slice(0, -1).join(' '),
      family: words[words.length - 1],
    }
  }

  // Find where family starts (last uppercase word sequence)
  let familyStart = words.length - 1
  for (let i = words.length - 2; i >= vonStart; i--) {
    if (words[i][0] && words[i][0] === words[i][0].toUpperCase()) {
      break
    }
    familyStart = i
  }

  const given = words.slice(0, vonStart).join(' ') || undefined
  const particle = words.slice(vonStart, familyStart).join(' ') || undefined
  const family = words.slice(familyStart).join(' ')

  return clean({
    given,
    family,
    'non-dropping-particle': particle,
  })
}

function clean(obj) {
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== '') result[k] = v
  }
  return result
}

// ── BibTeX → CSL-JSON field mapping ─────────────────────────────────────────

function convertToCSL(entry) {
  const { type, key, fields } = entry
  const item = {
    id: key,
    type: TYPE_MAP[type] || 'article',
  }

  // Genre for thesis types
  if (type === 'phdthesis') item.genre = 'PhD thesis'
  else if (type === 'mastersthesis') item.genre = "Master's thesis"

  // Names
  if (fields.author) item.author = parseNames(fields.author)
  if (fields.editor) item.editor = parseNames(fields.editor)
  if (fields.translator) item.translator = parseNames(fields.translator)

  // Title
  if (fields.title) item.title = convertLatex(fields.title)

  // Container title depends on entry type
  if (fields.journal) item['container-title'] = convertLatex(fields.journal)
  else if (fields.booktitle) item['container-title'] = convertLatex(fields.booktitle)

  // Date
  const year = fields.year ? parseInt(fields.year, 10) : null
  const month = fields.month != null ? parseMonth(fields.month) : null
  if (year) {
    const dateParts = [year]
    if (month) dateParts.push(month)
    item.issued = { 'date-parts': [dateParts] }
  }

  // Simple string fields
  const stringFields = {
    volume: 'volume',
    number: 'issue',
    pages: 'page',
    doi: 'DOI',
    url: 'URL',
    isbn: 'ISBN',
    issn: 'ISSN',
    publisher: 'publisher',
    address: 'publisher-place',
    edition: 'edition',
    series: 'collection-title',
    note: 'note',
    abstract: 'abstract',
    keywords: 'keyword',
    language: 'language',
    chapter: 'chapter-number',
  }

  for (const [bibField, cslField] of Object.entries(stringFields)) {
    if (fields[bibField]) {
      let val = convertLatex(fields[bibField])
      // Normalize page ranges: -- → –
      if (cslField === 'page') val = val.replace(/--/g, '–')
      item[cslField] = val
    }
  }

  // Publisher from school/institution for thesis/report
  if (!item.publisher) {
    if (fields.school) item.publisher = convertLatex(fields.school)
    else if (fields.institution) item.publisher = convertLatex(fields.institution)
  }

  // howpublished → URL if it looks like a URL
  if (fields.howpublished && !item.URL) {
    const hp = convertLatex(fields.howpublished)
    if (/^https?:\/\//i.test(hp)) item.URL = hp
  }

  return item
}

function parseMonth(val) {
  if (typeof val === 'number') return val
  const str = String(val).trim().toLowerCase()
  // Direct month number
  const num = parseInt(str, 10)
  if (!isNaN(num) && num >= 1 && num <= 12) return num
  // 3-letter abbreviation
  return MONTH_MAP[str.slice(0, 3)] || null
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseBibtex(bibtex) {
  if (!bibtex || typeof bibtex !== 'string') return []
  const { entries } = parseRawEntries(bibtex)
  return entries.map(entry => convertToCSL(entry))
}
