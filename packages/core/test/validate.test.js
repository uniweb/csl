import { describe, it, expect } from 'vitest'
import { validateItem } from '../src/validate.js'

describe('validateItem', () => {
  it('accepts a valid item', () => {
    const { valid, warnings } = validateItem({
      id: 'smith2024',
      type: 'article-journal',
      title: 'A Test',
      author: [{ family: 'Smith', given: 'John' }],
      issued: { 'date-parts': [[2024]] },
    })
    expect(valid).toBe(true)
    expect(warnings).toEqual([])
  })

  it('requires id', () => {
    const { valid, warnings } = validateItem({ type: 'book' })
    expect(valid).toBe(false)
    expect(warnings).toContain('Missing required field "id"')
  })

  it('requires type', () => {
    const { valid, warnings } = validateItem({ id: 'test' })
    expect(valid).toBe(false)
    expect(warnings).toContain('Missing required field "type"')
  })

  it('rejects unknown type', () => {
    const { warnings } = validateItem({ id: 'test', type: 'foobar' })
    expect(warnings).toContain('Unknown type "foobar"')
  })

  it('accepts all valid types', () => {
    for (const type of ['article-journal', 'book', 'chapter', 'thesis', 'webpage', 'paper-conference', 'report']) {
      const { valid } = validateItem({ id: 'test', type })
      expect(valid).toBe(true)
    }
  })

  it('validates name fields are arrays', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      author: 'Smith',
    })
    expect(warnings).toContain('"author" must be an array of name objects')
  })

  it('validates name objects have family or literal', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      author: [{ given: 'John' }],
    })
    expect(warnings).toContain('author[0] must have "family" or "literal"')
  })

  it('accepts literal names', () => {
    const { valid } = validateItem({
      id: 'test', type: 'book',
      author: [{ literal: 'World Health Organization' }],
    })
    expect(valid).toBe(true)
  })

  it('validates date fields', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      issued: 'not a date',
    })
    expect(warnings).toContain('"issued" must be a date object')
  })

  it('validates date-parts shape', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      issued: { 'date-parts': 'not an array' },
    })
    expect(warnings).toContain('issued.date-parts must be an array')
  })

  it('validates date-parts entries are non-empty arrays', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      issued: { 'date-parts': [[]] },
    })
    expect(warnings).toContain('issued.date-parts[0] must be a non-empty array [year, month?, day?]')
  })

  it('accepts literal dates', () => {
    const { valid } = validateItem({
      id: 'test', type: 'book',
      issued: { literal: 'Spring 2024' },
    })
    expect(valid).toBe(true)
  })

  it('accepts raw dates', () => {
    const { valid } = validateItem({
      id: 'test', type: 'book',
      issued: { raw: '2024-03-15' },
    })
    expect(valid).toBe(true)
  })

  it('warns on lowercase doi', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      doi: '10.1234/example',
    })
    expect(warnings).toContain('"doi" should be "DOI" (uppercase)')
  })

  it('warns on lowercase url', () => {
    const { warnings } = validateItem({
      id: 'test', type: 'book',
      url: 'https://example.com',
    })
    expect(warnings).toContain('"url" should be "URL" (uppercase)')
  })

  it('warns on lowercase isbn/issn', () => {
    const r1 = validateItem({ id: 'test', type: 'book', isbn: '123' })
    expect(r1.warnings).toContain('"isbn" should be "ISBN" (uppercase)')
    const r2 = validateItem({ id: 'test', type: 'book', issn: '456' })
    expect(r2.warnings).toContain('"issn" should be "ISSN" (uppercase)')
  })

  it('rejects null/undefined', () => {
    expect(validateItem(null).valid).toBe(false)
    expect(validateItem(undefined).valid).toBe(false)
  })

  it('validates editor, translator, and other name fields', () => {
    const { valid } = validateItem({
      id: 'test', type: 'book',
      editor: [{ family: 'Jones', given: 'Jane' }],
      translator: [{ family: 'Garcia' }],
    })
    expect(valid).toBe(true)
  })

  it('validates multiple date fields', () => {
    const { valid } = validateItem({
      id: 'test', type: 'webpage',
      issued: { 'date-parts': [[2024, 3, 15]] },
      accessed: { 'date-parts': [[2024, 6, 1]] },
    })
    expect(valid).toBe(true)
  })
})
