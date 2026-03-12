import { describe, it, expect } from 'vitest'
import { ordinal, longOrdinal, roman } from '../src/numbers.js'

describe('ordinal', () => {
  it('formats common ordinals', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
    expect(ordinal(22)).toBe('22nd')
    expect(ordinal(100)).toBe('100th')
    expect(ordinal(101)).toBe('101st')
  })

  it('handles null/NaN', () => {
    expect(ordinal(null)).toBe('')
  })
})

describe('longOrdinal', () => {
  it('formats 1-10 as words', () => {
    expect(longOrdinal(1)).toBe('first')
    expect(longOrdinal(2)).toBe('second')
    expect(longOrdinal(10)).toBe('tenth')
  })

  it('falls back to ordinal for >10', () => {
    expect(longOrdinal(11)).toBe('11th')
  })
})

describe('roman', () => {
  it('converts numbers to lowercase roman numerals', () => {
    expect(roman(1)).toBe('i')
    expect(roman(4)).toBe('iv')
    expect(roman(9)).toBe('ix')
    expect(roman(14)).toBe('xiv')
    expect(roman(42)).toBe('xlii')
    expect(roman(2024)).toBe('mmxxiv')
  })

  it('handles edge cases', () => {
    expect(roman(null)).toBe('')
    expect(roman(0)).toBe('0')
  })
})
