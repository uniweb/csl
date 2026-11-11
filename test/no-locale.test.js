/**
 * With no locale passed, a compiled style formats exactly as it did before locales were read at
 * format time: every style in test/fixtures, with its own default and each --locale, and every CSL
 * suite fixture, over test/fixtures/corpus.json. The record was made with the compiler before
 * that change; see test/helpers/no-locale-outputs.js.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { outputDigests, RECORD } from './helpers/no-locale-outputs.js'

describe('no locale: the output before format-time locales', () => {
  it('is unchanged for every style, default locale and CSL suite fixture', async () => {
    const record = JSON.parse(readFileSync(RECORD, 'utf8'))
    const now = await outputDigests()
    expect(Object.keys(now).sort()).toEqual(Object.keys(record).sort())
    const changed = Object.keys(record).filter((key) => now[key] !== record[key])
    expect(changed).toEqual([])
  }, 60_000)
})
