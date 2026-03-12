import { describe, it, expect } from 'vitest'
import { escapeHtml } from '../src/html.js'

describe('escapeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#x27;s')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello, World')).toBe('Hello, World')
    expect(escapeHtml('No special chars here')).toBe('No special chars here')
  })
})
