import { describe, it, expect } from 'vitest'
import { titleCase, sentenceCase, capitalize } from '../src/text.js'

describe('titleCase', () => {
  it('returns empty for falsy input', () => {
    expect(titleCase('')).toBe('')
    expect(titleCase(null)).toBe('')
  })

  it('capitalizes all words', () => {
    expect(titleCase('the quick brown fox')).toBe('The Quick Brown Fox')
  })

  it('lowercases stop words (except first/last)', () => {
    expect(titleCase('A STUDY OF THE EFFECTS')).toBe('A Study of the Effects')
  })

  it('always capitalizes first and last word', () => {
    expect(titleCase('the quick and the')).toBe('The Quick and The')
  })
})

describe('sentenceCase', () => {
  it('returns empty for falsy input', () => {
    expect(sentenceCase('')).toBe('')
  })

  it('lowercases all except first character', () => {
    expect(sentenceCase('A Study of Citation Formatting'))
      .toBe('A study of citation formatting')
  })

  it('capitalizes after colon+space', () => {
    expect(sentenceCase('MAIN TITLE: A SUBTITLE'))
      .toBe('Main title: A subtitle')
  })
})

describe('capitalize', () => {
  it('capitalizes first character', () => {
    expect(capitalize('hello')).toBe('Hello')
    expect(capitalize('HELLO')).toBe('HELLO')
  })

  it('returns empty for falsy input', () => {
    expect(capitalize('')).toBe('')
    expect(capitalize(null)).toBe('')
  })
})
