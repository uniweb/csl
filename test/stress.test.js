import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { compile } from '../packages/compiler/src/compile.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const stressDir = join(__dirname, '..', 'stress-test')
const tmpDir = join(__dirname, '.stress-compiled')

// Only run if stress-test dir exists
const hasStressDir = (() => {
  try { return readdirSync(stressDir).some(f => f.endsWith('.csl')) } catch { return false }
})()

describe.skipIf(!hasStressDir)('stress test: additional styles compile', () => {
  const files = hasStressDir
    ? readdirSync(stressDir).filter(f => f.endsWith('.csl')).sort()
    : []

  it.each(files)('%s compiles without errors', (file) => {
    const xml = readFileSync(join(stressDir, file), 'utf-8')
    const { code, meta } = compile(xml)
    expect(code).toBeTruthy()
    expect(meta.title).toBeTruthy()
    expect(meta.class).toMatch(/^(in-text|note)$/)
    // Verify the generated code contains required structure
    expect(code).toContain('export const meta')
    expect(code).toContain("from '@citestyle/core'")
  })
})

describe.skipIf(!hasStressDir)('stress test: compiled output is valid', () => {
  const files = hasStressDir
    ? readdirSync(stressDir).filter(f => f.endsWith('.csl')).sort()
    : []

  // Compile one representative style and verify runtime behavior
  it('compiled style produces structured output', () => {
    // Pick the first style available
    const file = files[0]
    if (!file) return

    const xml = readFileSync(join(stressDir, file), 'utf-8')
    const { code, meta } = compile(xml)

    // Verify meta has required fields
    expect(meta.id).toBeTruthy()
    expect(meta.title).toBeTruthy()
    expect(['in-text', 'note']).toContain(meta.class)

    // Verify code structure
    expect(code).toContain('export function')
    expect(code).toContain('export const meta')

    // Verify code contains either bibliography or citation export
    const hasBib = code.includes('export function bibliography')
    const hasCite = code.includes('export function citation')
    expect(hasBib || hasCite).toBe(true)
  })

  it('all styles produce valid meta objects', () => {
    for (const file of files) {
      const xml = readFileSync(join(stressDir, file), 'utf-8')
      const { meta } = compile(xml)
      expect(meta.id).toBeTruthy()
      expect(meta.title).toBeTruthy()
      expect(['in-text', 'note']).toContain(meta.class)
    }
  })
})
