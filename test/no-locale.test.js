/**
 * With no locale passed, every compiled style formats exactly as the record says: every style in
 * test/fixtures, with its own default and each --locale, and every CSL suite fixture, over
 * test/fixtures/corpus.json. A change that moves an output re-records it, on purpose; see
 * test/helpers/no-locale-outputs.js.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { outputDigests, RECORD } from './helpers/no-locale-outputs.js'

describe('no locale: the recorded output', () => {
  it('is unchanged for every style, default locale and CSL suite fixture', async () => {
    const record = JSON.parse(readFileSync(RECORD, 'utf8'))
    const now = await outputDigests()
    expect(Object.keys(now).sort()).toEqual(Object.keys(record).sort())
    const changed = Object.keys(record).filter((key) => now[key] !== record[key])
    expect(changed).toEqual([])
  }, 60_000)
})
