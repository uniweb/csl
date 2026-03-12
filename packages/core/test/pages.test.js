import { describe, it, expect } from 'vitest'
import { pageRange } from '../src/pages.js'

describe('pageRange', () => {
  it('returns empty for falsy input', () => {
    expect(pageRange('')).toBe('')
    expect(pageRange(null)).toBe('')
  })

  it('normalizes hyphen to en-dash in expanded format', () => {
    expect(pageRange('321-328', 'expanded')).toBe('321\u2013328')
  })

  it('handles minimal format', () => {
    expect(pageRange('321-328', 'minimal')).toBe('321\u20138')
  })

  it('handles minimal-two format', () => {
    expect(pageRange('321-328', 'minimal-two')).toBe('321\u201328')
  })

  it('handles chicago format', () => {
    expect(pageRange('321-328', 'chicago')).toBe('321\u201328')
    expect(pageRange('1087-1089', 'chicago')).toBe('1087\u201389')
    expect(pageRange('3-10', 'chicago')).toBe('3\u201310')
    expect(pageRange('100-104', 'chicago')).toBe('100\u2013104')
  })

  it('passes through non-numeric ranges', () => {
    expect(pageRange('xii-xiv', 'chicago')).toBe('xii\u2013xiv')
  })
})
