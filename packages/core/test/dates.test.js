import { describe, it, expect } from 'vitest'
import { formatDate } from '../src/dates.js'

describe('formatDate', () => {
  it('returns empty string for null/empty input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate({})).toBe('')
    expect(formatDate({ 'date-parts': [] })).toBe('')
  })

  it('formats year only', () => {
    const date = { 'date-parts': [[2024]] }
    expect(formatDate(date, {
      dateParts: [{ name: 'year' }],
    })).toBe('2024')
  })

  it('formats year and month', () => {
    const date = { 'date-parts': [[2024, 3]] }
    expect(formatDate(date, {
      dateParts: [
        { name: 'year' },
        { name: 'month', prefix: ', ' },
      ],
    })).toBe('2024, March')
  })

  it('formats full date with short month', () => {
    const date = { 'date-parts': [[2024, 3, 15]] }
    expect(formatDate(date, {
      dateParts: [
        { name: 'month', form: 'short' },
        { name: 'day', suffix: ', ' },
        { name: 'year' },
      ],
    })).toBe('Mar15, 2024')
  })

  it('formats numeric date with leading zeros', () => {
    const date = { 'date-parts': [[2024, 3, 5]] }
    expect(formatDate(date, {
      dateParts: [
        { name: 'month', form: 'numeric-leading-zeros', suffix: '/' },
        { name: 'day', form: 'numeric-leading-zeros', suffix: '/' },
        { name: 'year' },
      ],
    })).toBe('03/05/2024')
  })

  it('handles literal dates', () => {
    expect(formatDate({ literal: 'Spring 2024' })).toBe('Spring 2024')
  })

  it('handles date ranges', () => {
    const date = { 'date-parts': [[2020], [2024]] }
    expect(formatDate(date, {
      dateParts: [{ name: 'year' }],
    })).toBe('2020\u20132024')
  })

  it('handles short year form', () => {
    const date = { 'date-parts': [[2024]] }
    expect(formatDate(date, {
      dateParts: [{ name: 'year', form: 'short' }],
    })).toBe('24')
  })
})
