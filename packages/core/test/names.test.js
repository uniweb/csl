import { describe, it, expect } from 'vitest'
import { formatNames } from '../src/names.js'

describe('formatNames', () => {
  it('returns empty string for null/empty input', () => {
    expect(formatNames(null)).toBe('')
    expect(formatNames([])).toBe('')
    expect(formatNames(undefined)).toBe('')
  })

  it('formats a single name (given first)', () => {
    const names = [{ family: 'Smith', given: 'John' }]
    expect(formatNames(names)).toBe('John Smith')
  })

  it('formats a single name inverted (family first)', () => {
    const names = [{ family: 'Smith', given: 'John' }]
    expect(formatNames(names, { nameAsSortOrder: 'all' })).toBe('Smith, John')
  })

  it('initializes given names', () => {
    const names = [{ family: 'Smith', given: 'John Andrew' }]
    expect(formatNames(names, {
      initialize: true,
      initializeWith: '. ',
      nameAsSortOrder: 'all',
    })).toBe('Smith, J. A.')
  })

  it('handles hyphenated given names', () => {
    const names = [{ family: 'Dupont', given: 'Jean-Pierre' }]
    expect(formatNames(names, {
      initialize: true,
      initializeWith: '. ',
    })).toBe('J.-P. Dupont')
  })

  it('joins two names with "and" text', () => {
    const names = [
      { family: 'Smith', given: 'John' },
      { family: 'Jones', given: 'Jane' },
    ]
    expect(formatNames(names, { and: 'text', andTerm: 'and' }))
      .toBe('John Smith and Jane Jones')
  })

  it('joins two names with "&" symbol', () => {
    const names = [
      { family: 'Smith', given: 'John' },
      { family: 'Jones', given: 'Jane' },
    ]
    expect(formatNames(names, { and: 'symbol' }))
      .toBe('John Smith & Jane Jones')
  })

  it('joins three names with delimiter and &', () => {
    const names = [
      { family: 'Smith', given: 'J.' },
      { family: 'Jones', given: 'B.' },
      { family: 'Chen', given: 'W.' },
    ]
    expect(formatNames(names, {
      and: 'symbol',
      delimiter: ', ',
      delimiterPrecedesLast: 'always',
    })).toBe('J. Smith, B. Jones, & W. Chen')
  })

  it('applies et-al truncation', () => {
    const names = [
      { family: 'A', given: 'X' },
      { family: 'B', given: 'Y' },
      { family: 'C', given: 'Z' },
    ]
    expect(formatNames(names, {
      etAlMin: 3,
      etAlUseFirst: 1,
    })).toBe('X A et al.')
  })

  it('handles form="short" (family name only)', () => {
    const names = [
      { family: 'Smith', given: 'John Andrew' },
      { family: 'Jones', given: 'Barbara' },
    ]
    expect(formatNames(names, {
      form: 'short',
      and: 'symbol',
    })).toBe('Smith & Jones')
  })

  it('handles literal (institutional) names', () => {
    const names = [{ literal: 'World Health Organization' }]
    expect(formatNames(names)).toBe('World Health Organization')
  })

  it('handles non-dropping particles', () => {
    const names = [{ family: 'Beethoven', given: 'Ludwig', 'non-dropping-particle': 'van' }]
    expect(formatNames(names, { nameAsSortOrder: 'all' }))
      .toBe('van Beethoven, Ludwig')
  })

  it('handles APA-style formatting', () => {
    const names = [
      { family: 'Smith', given: 'John Andrew' },
      { family: 'Jones', given: 'Barbara Carol' },
    ]
    expect(formatNames(names, {
      and: 'symbol',
      delimiter: ', ',
      delimiterPrecedesLast: 'always',
      initialize: true,
      initializeWith: '. ',
      nameAsSortOrder: 'all',
      sortSeparator: ', ',
    })).toBe('Smith, J. A., & Jones, B. C.')
  })

  it('handles et-al-use-last (ellipsis pattern)', () => {
    const names = Array.from({ length: 25 }, (_, i) => ({
      family: 'Author' + (i + 1),
      given: 'A',
    }))
    const result = formatNames(names, {
      etAlMin: 21,
      etAlUseFirst: 19,
      etAlUseLast: true,
      and: 'symbol',
      delimiter: ', ',
      delimiterPrecedesLast: 'always',
    })
    expect(result).toContain('\u2026')
    expect(result).toContain('Author25')
    expect(result).toContain('Author19')
    expect(result).not.toContain('Author20')
  })
})
