import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll } from 'vitest'
import { buildPacks, buildIndex } from '../generate.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(__dirname, '..', 'vendor')
const built = buildPacks()
const { packs } = built
const xmlLangs = readdirSync(VENDOR).filter((f) => /^locales-.+\.xml$/.test(f)).map((f) => f.slice(8, -4)).sort()

describe('packs', () => {
  it('makes one pack per official CSL locale file, in format version 1', () => {
    expect([...packs.keys()].sort()).toEqual(xmlLangs)
    expect(xmlLangs.length).toBe(63)
    for (const [lang, pack] of packs) {
      expect(pack.version).toBe(1)
      expect(pack.lang).toBe(lang)
    }
  })

  it('makes each pack plain data: a JSON round trip leaves it unchanged', () => {
    for (const pack of packs.values()) {
      expect(JSON.parse(JSON.stringify(pack))).toStrictEqual(pack)
    }
  })

  it('keeps a term\'s text as the locale file writes it, spaces and all', () => {
    const fr = packs.get('fr-FR')
    expect(fr.terms['open-quote']).toBe('« ')
    expect(fr.terms['close-quote']).toBe(' »')
    expect(fr.terms['no date:short']).toBe('s. d.')
    expect(fr.terms.editor).toEqual({ single: 'éditeur', multiple: 'éditeurs' })
  })

  it('carries every term, gender-form variants, match, nouns\' genders, date formats and options', () => {
    const fr = packs.get('fr-FR')
    expect(Object.keys(fr.terms).length).toBeGreaterThan(350)
    expect(fr.variants['ordinal-01']).toEqual({ feminine: 'ʳᵉ', masculine: 'ᵉʳ' })
    expect(fr.match['ordinal-01']).toBe('whole-number')
    expect(fr.genders.edition).toBe('feminine')
    expect(fr.genders['month-01']).toBe('masculine')
    expect(fr.dates.text.parts.map((p) => p.name)).toEqual(['day', 'month', 'year'])
    expect(fr.options).toEqual({ punctuationInQuote: false, limitDayOrdinalsToDay1: true })
  })

  it('merges a dialect over its language\'s primary dialect: a term only the primary defines', () => {
    // locales-de-CH.xml has no "graphic" or "hearing"; de-DE's, not en-US's, fill them
    expect(packs.get('de-CH').terms.graphic).toBe('Bild')
    expect(packs.get('de-CH').terms.hearing).toBe('Anhörung')
    // locales-pt-BR.xml has no verb form of "director"; pt-PT's fills it
    expect(packs.get('pt-BR').terms['director:verb']).toBe('dirigido por')
    // and the dialect's own terms win
    expect(packs.get('pt-BR').lang).toBe('pt-BR')
    expect(packs.get('fr-CA').terms['open-quote']).toBe(packs.get('fr-FR').terms['open-quote'])
  })

  it('leaves en-US to each compiled style, and en-GB unmerged over it', () => {
    expect(packs.get('en-US')).toStrictEqual({ version: 1, lang: 'en-US' })
    expect(packs.get('en-GB').terms['open-quote']).toBe('‘')
    expect(packs.get('en-GB').options.punctuationInQuote).toBe(false)
  })

  it('names each language\'s primary dialect as CSL 1.0.2 lists it', () => {
    for (const [language, primary] of Object.entries({ de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', zh: 'zh-CN' })) {
      expect(built.primaryDialects[language]).toBe(primary)
      expect(built.aliases.get(language)).toBe(primary)
    }
  })
})

describe('the corpus index', () => {
  const index = buildIndex(built)

  it('lists every locale with its primary-dialect fallback', () => {
    expect(index.version).toBe(1)
    expect(Object.keys(index.locales).sort()).toEqual(xmlLangs)
    expect(index.locales['fr-CA'].fallback).toBe('fr-FR')
    expect(index.locales['fr-FR'].fallback).toBeNull()
    expect(index.locales['en-GB'].fallback).toBe('en-US')
    expect(index.locales['pt-BR'].fallback).toBe('pt-PT')
    expect(index.languages.fr).toBe('fr-FR')
    expect(index.languages.sr).toBe('sr-Latn-RS')
  })

  it('credits the CSL project, its license, and each file\'s translators', () => {
    expect(index.source).toMatchObject({ url: 'https://citationstyles.org/', license: 'CC-BY-SA-3.0' })
    expect(index.source.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(index.locales['fr-CA'].sources.map((s) => s.file)).toEqual(['locales-fr-FR.xml', 'locales-fr-CA.xml'])
    expect(index.locales['fr-FR'].sources[0].translators.map((t) => t.name)).toContain('Grégoire Colly')
    expect(index.locales['en-US'].sources).toEqual([])
  })
})

describe('the build', () => {
  let dir
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'citestyle-locales-'))
    execFileSync(process.execPath, [join(__dirname, '..', 'build.js'), dir], { stdio: 'pipe' })
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('writes each pack as a module and as locales/v1/<lang>.json, the same data', async () => {
    const jsonDir = join(dir, 'locales', 'v1')
    const jsonFiles = readdirSync(jsonDir).filter((f) => f !== 'index.json').map((f) => f.slice(0, -5)).sort()
    expect(jsonFiles).toEqual(xmlLangs)
    for (const lang of xmlLangs) {
      const mod = await import(pathToFileURL(join(dir, `${lang}.js`)).href)
      const json = JSON.parse(readFileSync(join(jsonDir, `${lang}.json`), 'utf8'))
      expect(mod.default).toStrictEqual(json)
      expect(Object.keys(mod)).toEqual(['default'])
    }
  })

  it('writes the index, and language modules that export their primary dialect\'s pack', async () => {
    const index = JSON.parse(readFileSync(join(dir, 'locales', 'v1', 'index.json'), 'utf8'))
    expect(index).toStrictEqual(JSON.parse(JSON.stringify(buildIndex(built))))
    const fr = await import(pathToFileURL(join(dir, 'fr.js')).href)
    const frFR = await import(pathToFileURL(join(dir, 'fr-FR.js')).href)
    expect(fr.default).toBe(frFR.default)
  })

  it('keeps the rights notice and the translators in each module', () => {
    const source = readFileSync(join(dir, 'fr-CA.js'), 'utf8')
    expect(source).toMatch(/^\/\*! @citestyle\/locales fr-CA/)
    expect(source).toContain('https://citationstyles.org/')
    expect(source).toContain('Creative Commons Attribution-ShareAlike 3.0 License')
    expect(source).toContain('locales-fr-FR.xml over locales-fr-CA.xml')
    expect(source).toContain('Translators: Grégoire Colly')
  })
})
