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

  it('handles et-al-use-last (ellipsis pattern without "and")', () => {
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
    // Should NOT have "and" or "&" before last name
    expect(result).not.toContain('& A Author25')
    expect(result).toMatch(/\u2026 A Author25$/)
  })

  // ── delimiter-precedes-et-al ────────────────────────────────────────────

  it('delimiter-precedes-et-al="always" adds delimiter before et al.', () => {
    const names = [{ family: 'Smith', given: 'J.' }]
    const result = formatNames(names, {
      etAlMin: 1,
      etAlUseFirst: 1,
      delimiterPrecedesEtAl: 'always',
      delimiter: ', ',
    })
    // Single name + delimiter + et al.
    expect(result).toBe('J. Smith, et al.')
  })

  it('delimiter-precedes-et-al="never" uses space before et al.', () => {
    const names = [
      { family: 'Smith', given: 'J.' },
      { family: 'Jones', given: 'B.' },
      { family: 'Chen', given: 'W.' },
    ]
    const result = formatNames(names, {
      etAlMin: 3,
      etAlUseFirst: 2,
      delimiterPrecedesEtAl: 'never',
      delimiter: ', ',
    })
    expect(result).toBe('J. Smith, B. Jones et al.')
  })

  it('delimiter-precedes-et-al="contextual" (default): delimiter only for 2+ shown names', () => {
    const one = [{ family: 'Smith', given: 'J.' }, { family: 'Jones', given: 'B.' }]
    // 1 shown name — no delimiter before et al.
    expect(formatNames(one, { etAlMin: 2, etAlUseFirst: 1, delimiter: ', ' }))
      .toBe('J. Smith et al.')

    const three = [
      { family: 'Smith', given: 'J.' },
      { family: 'Jones', given: 'B.' },
      { family: 'Chen', given: 'W.' },
    ]
    // 2 shown names — delimiter before et al.
    expect(formatNames(three, { etAlMin: 3, etAlUseFirst: 2, delimiter: ', ' }))
      .toBe('J. Smith, B. Jones, et al.')
  })

  it('delimiter-precedes-et-al="after-inverted-name"', () => {
    const names = [{ family: 'Smith', given: 'John' }, { family: 'Jones', given: 'Jane' }]
    // With name-as-sort-order — inverted names get delimiter
    expect(formatNames(names, {
      etAlMin: 2,
      etAlUseFirst: 1,
      delimiterPrecedesEtAl: 'after-inverted-name',
      nameAsSortOrder: 'first',
      delimiter: ', ',
    })).toBe('Smith, John, et al.')

    // Without name-as-sort-order — no delimiter
    expect(formatNames(names, {
      etAlMin: 2,
      etAlUseFirst: 1,
      delimiterPrecedesEtAl: 'after-inverted-name',
      delimiter: ', ',
    })).toBe('John Smith et al.')
  })

  // ── name-part formatting ────────────────────────────────────────────────

  it('applies name-part text-case="uppercase" to family names', () => {
    const names = [{ family: 'Smith', given: 'John' }]
    expect(formatNames(names, {
      nameParts: [{ name: 'family', textCase: 'uppercase' }],
    })).toBe('John SMITH')
  })

  it('applies name-part text-case to given names', () => {
    const names = [{ family: 'Smith', given: 'john andrew' }]
    expect(formatNames(names, {
      nameParts: [{ name: 'given', textCase: 'capitalize-all' }],
    })).toBe('John Andrew Smith')
  })

  it('applies name-part font-variant="small-caps" using PUA tokens', () => {
    const names = [{ family: 'Smith', given: 'John' }]
    const result = formatNames(names, {
      nameParts: [{ name: 'family', fontVariant: 'small-caps' }],
    })
    // Should contain PUA small-caps tokens around family name
    expect(result).toContain('\uE004Smith\uE005')
  })

  it('applies name-part formatting in form="short"', () => {
    const names = [{ family: 'Smith', given: 'John' }]
    expect(formatNames(names, {
      form: 'short',
      nameParts: [{ name: 'family', textCase: 'uppercase' }],
    })).toBe('SMITH')
  })
})
