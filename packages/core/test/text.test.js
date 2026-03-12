import { describe, it, expect } from 'vitest'
import { titleCase, sentenceCase, capitalize, applyTextCase, stripNocaseSpans } from '../src/text.js'

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

  it('preserves words with internal capitals (abbreviations)', () => {
    expect(titleCase('a guide to OpenAI')).toBe('A Guide to OpenAI')
    expect(titleCase('learning JavaScript today')).toBe('Learning JavaScript Today')
    expect(titleCase('the PhD thesis')).toBe('The PhD Thesis')
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

describe('nocase span protection', () => {
  it('preserves nocase content in titleCase', () => {
    expect(titleCase('a study of <span class="nocase">iPhone</span> usage'))
      .toBe('A Study of iPhone Usage')
  })

  it('preserves nocase content in sentenceCase', () => {
    expect(sentenceCase('THE IMPACT OF <span class="nocase">GraphQL</span> ON APIS'))
      .toBe('The impact of GraphQL on apis')
  })

  it('preserves nocase content in lowercase via applyTextCase', () => {
    expect(applyTextCase('HELLO <span class="nocase">World</span> TEST', 'lowercase'))
      .toBe('hello World test')
  })

  it('preserves nocase content in uppercase via applyTextCase', () => {
    expect(applyTextCase('hello <span class="nocase">World</span> test', 'uppercase'))
      .toBe('HELLO World TEST')
  })

  it('handles multiple nocase spans', () => {
    expect(titleCase('a <span class="nocase">pH</span> test for <span class="nocase">mRNA</span>'))
      .toBe('A pH Test for mRNA')
  })

  it('handles nocase with PUA tokens inside', () => {
    // PUA tokens (U+E000-E001 = italic) inside nocase span
    expect(titleCase('a study of <span class="nocase">\uE000iPhone\uE001</span>'))
      .toBe('A Study of \uE000iPhone\uE001')
  })

  it('passes through strings without nocase spans unchanged', () => {
    expect(titleCase('the quick brown fox')).toBe('The Quick Brown Fox')
  })

  it('stripNocaseSpans removes spans without transform', () => {
    expect(stripNocaseSpans('hello <span class="nocase">World</span>'))
      .toBe('hello World')
  })

  it('stripNocaseSpans handles no spans', () => {
    expect(stripNocaseSpans('hello world')).toBe('hello world')
  })

  it('stripNocaseSpans handles empty/falsy input', () => {
    expect(stripNocaseSpans('')).toBe('')
    expect(stripNocaseSpans(null)).toBe('')
  })

  it('nocase word not treated as first/last for title case', () => {
    // "smith" is nocase, "a" before it is a stop word and should stay lowercase
    expect(titleCase('this IS a pen that is a <span class="nocase">smith</span> pencil'))
      .toBe('This IS a Pen That Is a smith Pencil')
  })
})
