/**
 * Generate the locale packs from the official CSL locale files in vendor/.
 *
 * One pack per locale file: its terms, gender variants, nouns' genders, date formats and options,
 * as plain data in the format `@citestyle/core`'s `localize` reads (format version 1). A secondary
 * dialect is merged over its language's primary dialect (fr-CA over fr-FR, pt-BR over pt-PT), so
 * each pack is complete for its language. en-US is not merged into any pack, and its own pack is
 * empty: every compiled style carries the en-US terms it can reach, under any pack.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deepStrictEqual } from 'node:assert'
import { readLocaleFile } from '@citestyle/compiler'
import { mergeLayers, LOCALE_FORMAT } from '@citestyle/core'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const VENDOR = join(__dirname, 'vendor')

// The primary dialects CSL 1.0.2 lists (specification, "Locale Fallback"). vendor/locales.json,
// the CSL project's table, must agree; it also covers the languages the specification doesn't list.
const SPEC_PRIMARY_DIALECTS = { de: 'de-DE', en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT', zh: 'zh-CN' }

const FIELDS = ['terms', 'variants', 'match', 'genders', 'dates', 'options']

/**
 * Build every pack.
 *
 * @returns {{ source: object, primaryDialects: Record<string, string>, packs: Map<string, object>, info: Map<string, object>, aliases: Map<string, string> }}
 *   `packs` and `info` by lang; `aliases` maps a language code to the pack of its primary dialect.
 */
export function buildPacks() {
  const source = JSON.parse(readFileSync(join(VENDOR, 'source.json'), 'utf8'))
  const primaryDialects = JSON.parse(readFileSync(join(VENDOR, 'locales.json'), 'utf8'))['primary-dialects']
  for (const [language, primary] of Object.entries(SPEC_PRIMARY_DIALECTS)) {
    if (primaryDialects[language] !== primary) {
      throw new Error(`locales.json makes ${primaryDialects[language]} the primary dialect of "${language}"; CSL 1.0.2 says ${primary}`)
    }
  }

  const files = new Map()
  for (const file of readdirSync(VENDOR).filter((f) => /^locales-.+\.xml$/.test(f)).sort()) {
    const lang = file.slice('locales-'.length, -'.xml'.length)
    const { layer, info } = readLocaleFile(readFileSync(join(VENDOR, file), 'utf8'))
    if (layer.lang !== lang) throw new Error(`${file} declares xml:lang="${layer.lang}"`)
    files.set(lang, { file, layer, info })
  }

  const packs = new Map()
  const info = new Map()
  for (const [lang, { file, layer, info: fileInfo }] of files) {
    const primary = primaryOf(lang, primaryDialects)
    const sources = []
    let data
    if (lang === 'en-US') {
      data = { lang }
    } else if (primary && primary !== lang && primary !== 'en-US') {
      const base = files.get(primary)
      if (!base) throw new Error(`${file}: its primary dialect ${primary} has no locale file`)
      data = mergeLayers(base.layer, layer)
      sources.push({ file: base.file, ...base.info })
    } else {
      data = layer
    }
    if (lang !== 'en-US') sources.push({ file, ...fileInfo })
    packs.set(lang, toPack(lang, data))
    info.set(lang, { fallback: primary && primary !== lang ? primary : null, sources })
  }

  const aliases = new Map()
  for (const [language, primary] of Object.entries(primaryDialects)) {
    if (language !== primary && !packs.has(language) && packs.has(primary)) aliases.set(language, primary)
  }

  return { source, primaryDialects, packs, info, aliases }
}

function primaryOf(lang, primaryDialects) {
  return primaryDialects[lang.split('-')[0]] || null
}

/** A pack: the format version, the lang, then the layer's non-empty fields — plain data. */
function toPack(lang, layer) {
  const pack = { version: LOCALE_FORMAT, lang }
  for (const field of FIELDS) {
    if (layer[field] && Object.keys(layer[field]).length) pack[field] = layer[field]
  }
  // A pack is served as JSON as well as imported: a JSON round trip must not change it, and no
  // key may be one an object literal reads differently from JSON.parse
  deepStrictEqual(JSON.parse(JSON.stringify(pack)), pack)
  if (JSON.stringify(pack).includes('"__proto__"')) throw new Error(`${lang}: a key is "__proto__"`)
  return pack
}

/**
 * The corpus index, `locales/v1/index.json`: each locale with the primary dialect CSL falls back
 * to, the language table, and where the data comes from.
 */
export function buildIndex({ source, primaryDialects, info }) {
  const locales = {}
  for (const [lang, entry] of info) {
    locales[lang] = {
      fallback: entry.fallback,
      sources: entry.sources.map(({ file, translators, updated }) => ({ file, translators, updated })),
    }
  }
  return {
    version: LOCALE_FORMAT,
    source: {
      project: 'Citation Style Language',
      url: 'https://citationstyles.org/',
      repository: source.repository,
      commit: source.commit,
      license: source.license,
      licenseUrl: source.licenseUrl,
    },
    languages: primaryDialects,
    locales,
  }
}

/** The ES module for a pack: its notice, then the pack as its default export. */
export function packModule(lang, pack, entry, source) {
  const lines = [`/*! @citestyle/locales ${lang}`]
  if (entry.sources.length === 0) {
    lines.push(' * en-US: every compiled style carries the en-US terms it can reach, so this pack holds none.')
    lines.push(' * It selects en-US, and the style\'s own <locale> elements for "en" and "en-US".')
  } else {
    const files = entry.sources.map((s) => s.file).join(' over ')
    lines.push(` * From the Citation Style Language project, https://citationstyles.org/: ${files}`)
    lines.push(` * (${source.repository}, commit ${source.commit}).`)
    for (const s of entry.sources) {
      if (s.rights) lines.push(` * ${s.file}: ${s.rights.text}${s.rights.license ? ` (${s.rights.license})` : ''}.`)
      const names = (s.translators || []).map(personLine).join('; ')
      if (names) lines.push(` * Translators: ${names}.`)
      if (s.updated) lines.push(` * Updated ${s.updated}.`)
    }
  }
  return [...lines.map(safeComment), ' */'].join('\n') + `\nexport default ${JSON.stringify(pack)}\n`
}

function personLine(person) {
  return [person.name, person.email && `<${person.email}>`, person.uri].filter(Boolean).join(' ')
}

function safeComment(line) {
  return line.replace(/\*\//g, '* /')
}
