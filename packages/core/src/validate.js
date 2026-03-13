/**
 * CSL-JSON item validation.
 *
 * Checks that a CSL-JSON item has required fields and correct shapes.
 * Returns an array of warning strings (empty = valid).
 */

const VALID_TYPES = new Set([
  'article', 'article-journal', 'article-magazine', 'article-newspaper',
  'bill', 'book', 'broadcast', 'chapter', 'dataset', 'entry',
  'entry-dictionary', 'entry-encyclopedia', 'figure', 'graphic',
  'interview', 'legal_case', 'legislation', 'manuscript', 'map',
  'motion_picture', 'musical_score', 'pamphlet', 'paper-conference',
  'patent', 'personal_communication', 'post', 'post-weblog',
  'regulation', 'report', 'review', 'review-book', 'software',
  'song', 'speech', 'standard', 'thesis', 'treaty', 'webpage',
])

const NAME_FIELDS = [
  'author', 'editor', 'translator', 'container-author', 'collection-editor',
  'composer', 'director', 'interviewer', 'reviewed-author', 'recipient',
  'illustrator', 'original-author',
]

const DATE_FIELDS = [
  'issued', 'accessed', 'original-date', 'submitted', 'event-date',
]

/**
 * Validate a CSL-JSON item.
 *
 * @param {object} item - CSL-JSON item to validate
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateItem(item) {
  const warnings = []

  if (!item || typeof item !== 'object') {
    return { valid: false, warnings: ['Item must be an object'] }
  }

  // Required: id
  if (item.id == null || item.id === '') {
    warnings.push('Missing required field "id"')
  }

  // Required: type
  if (!item.type) {
    warnings.push('Missing required field "type"')
  } else if (!VALID_TYPES.has(item.type)) {
    warnings.push(`Unknown type "${item.type}"`)
  }

  // Validate name fields are arrays of objects
  for (const field of NAME_FIELDS) {
    if (item[field] != null) {
      if (!Array.isArray(item[field])) {
        warnings.push(`"${field}" must be an array of name objects`)
      } else {
        for (let i = 0; i < item[field].length; i++) {
          const name = item[field][i]
          if (!name || typeof name !== 'object') {
            warnings.push(`${field}[${i}] must be a name object`)
          } else if (!name.family && !name.literal) {
            warnings.push(`${field}[${i}] must have "family" or "literal"`)
          }
        }
      }
    }
  }

  // Validate date fields
  for (const field of DATE_FIELDS) {
    if (item[field] != null) {
      const date = item[field]
      if (typeof date !== 'object' || Array.isArray(date)) {
        warnings.push(`"${field}" must be a date object`)
      } else if (!date['date-parts'] && !date.literal && !date.raw) {
        warnings.push(`"${field}" must have "date-parts", "literal", or "raw"`)
      } else if (date['date-parts']) {
        if (!Array.isArray(date['date-parts'])) {
          warnings.push(`${field}.date-parts must be an array`)
        } else {
          for (let i = 0; i < date['date-parts'].length; i++) {
            const dp = date['date-parts'][i]
            if (!Array.isArray(dp) || dp.length === 0) {
              warnings.push(`${field}.date-parts[${i}] must be a non-empty array [year, month?, day?]`)
            }
          }
        }
      }
    }
  }

  // Helpful warnings for common mistakes
  if (item.doi && !item.DOI) {
    warnings.push('"doi" should be "DOI" (uppercase)')
  }
  if (item.url && !item.URL) {
    warnings.push('"url" should be "URL" (uppercase)')
  }
  if (item.isbn && !item.ISBN) {
    warnings.push('"isbn" should be "ISBN" (uppercase)')
  }
  if (item.issn && !item.ISSN) {
    warnings.push('"issn" should be "ISSN" (uppercase)')
  }

  return { valid: warnings.length === 0, warnings }
}
