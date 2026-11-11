# @citestyle/locales

Format a compiled citation style in any of the official [CSL](https://citationstyles.org/) languages. One module per CSL locale (`@citestyle/locales/fr-FR`, `@citestyle/locales/de-DE`, …), each exporting a **locale pack**: the language's terms ("et", "Hrsg.", "p."), ordinals ("2ᵉ", "2.", "2.ª"), month names, date formats, quotation marks and punctuation rules, as plain data. About 3–4 KB gzipped each.

```bash
npm install @citestyle/locales
```

## Usage

Pass a pack as `locale` wherever a style formats:

```javascript
import { format, createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'
import fr from '@citestyle/locales/fr-FR'
import de from '@citestyle/locales/de-DE'

const book = {
  type: 'book', title: 'The art of computer programming', author: [{ family: 'Knuth', given: 'Donald Ervin' }],
  issued: { 'date-parts': [[1997]] }, publisher: 'Addison-Wesley', edition: '3', volume: '1',
}

format(apa, book, { locale: fr }).text
// Knuth, D. E. (1997). The art of computer programming (3ᵉ éd., Vol. 1). Addison-Wesley.
format(apa, book, { locale: de }).text
// Knuth, D. E. (1997). The art of computer programming (3. Aufl., Bd. 1). Addison-Wesley.

// A compiled style takes it directly, too
apa.bibliography(book, { locale: fr })
apa.citation([{ item: book }], { locale: fr })

// Every entry and citation of a registry in French, unless a call names another locale
const registry = createRegistry(apa, { locale: fr })
registry.cite([{ id: 'knuth1997' }], { locale: de })
```

Pass the pack object, not a language code. Import only the languages you use, and your bundler leaves out the rest. A call without `locale` formats in the style's default locale, resolved the same way.

A language code alone works as CSL defines it: `@citestyle/locales/fr` is the pack of French's primary dialect, fr-FR.

## How a style reads a pack

CSL 1.0.2 locale fallback. For each term, date format and option, a style uses the first of these that defines it:

1. the style's own `<locale xml:lang="fr-CA">`, for the pack's dialect;
2. the style's own `<locale xml:lang="fr">`, for its language;
3. the style's own `<locale>` without `xml:lang`;
4. the pack: its dialect, already merged over its language's primary dialect (fr-CA over fr-FR, pt-BR over pt-PT);
5. en-US, which every compiled style carries: the terms it can reach.

A form a locale doesn't define then falls back as CSL says ("verb-short" to "verb", "symbol" to "short", each to the long form). Defining any ordinal suffix term replaces all of them, so French never borrows the English "2nd". An ordinal takes the gender of its noun: "1ʳᵉ éd.", "1ᵉʳ volume".

So each pack is complete for its language, and `@citestyle/locales/en-US` is empty: it selects en-US, and the style's own English `<locale>` elements, for a style whose default is another language.

A style resolves a pack the first time it formats with it, and keeps the result for that pack.

## Packs as static files: a published contract

The build also writes every pack as a JSON file, to serve as static files:

```
dist/locales/v1/
  index.json      every locale, its primary-dialect fallback, its sources
  fr-FR.json      the same object @citestyle/locales/fr-FR exports
  de-DE.json
  …
```

They resolve as `@citestyle/locales/locales/v1/<lang>.json`. A pack fetched and parsed from one of them is passed exactly as an imported one: `{ locale: await response.json() }`.

**The layout and the pack format are a published contract.** Within a version, fields may be added that a reader of that version ignores; none is removed or changes meaning. A change a version-1 reader would misread is a new version, in its own directory (`locales/v2/`), with `"version": 2` in each pack; `locales/v1/` stays. A style given a pack in a version it doesn't read formats in its default locale and warns once on the console.

### Pack format, version 1

A pack is plain data: a JSON round trip leaves it unchanged. Fields that would be empty are left out.

| Field | Holds |
|---|---|
| `version` | `1` |
| `lang` | The CSL locale: `"fr-FR"`, `"ar"`, `"sr-Latn-RS"` |
| `terms` | Each term by `"name"` (its long form) or `"name:form"` (`short`, `verb`, `verb-short`, `symbol`): a string, or `{ "single", "multiple" }`. The text is exactly the locale file's: French `"open-quote"` is `"« "` |
| `variants` | Gender-form variants of a term: `{ "ordinal-01": { "feminine": "ʳᵉ", "masculine": "ᵉʳ" } }` |
| `match` | An ordinal term's `match`: `{ "ordinal-01": "whole-number" }` |
| `genders` | A noun's gender, by term name: `{ "edition": "feminine", "month-01": "masculine" }` |
| `dates` | The localized date formats: `{ "text": { "parts": [{ "name": "day", "suffix": " " }, …], "delimiter"?: … }, "numeric": … }` |
| `options` | `{ "punctuationInQuote": false, "limitDayOrdinalsToDay1": true }` |

### `index.json`

```json
{
  "version": 1,
  "source": { "project": "Citation Style Language", "url": "https://citationstyles.org/", "repository": "…", "commit": "…", "license": "CC-BY-SA-3.0", "licenseUrl": "…" },
  "languages": { "fr": "fr-FR", "pt": "pt-PT", "sr": "sr-Latn-RS", … },
  "locales": {
    "fr-CA": { "fallback": "fr-FR", "sources": [{ "file": "locales-fr-FR.xml", "translators": […], "updated": "…" }, { "file": "locales-fr-CA.xml", … }] },
    "fr-FR": { "fallback": null, "sources": [{ "file": "locales-fr-FR.xml", … }] },
    …
  }
}
```

`languages` maps each language to its primary dialect: the file for a language code, or for a dialect with no file of its own (fr-CH → fr → fr-FR). A locale's `fallback` is the primary dialect CSL falls back to; its pack already includes it, except en-US, which each compiled style carries.

## The locales

af-ZA, ar, bal-PK, bg-BG, brh-PK, ca-AD, cs-CZ, cy-GB, da-DK, de-AT, de-CH, de-DE, el-GR, en-GB, en-US, es-CL, es-ES, es-MX, et-EE, eu, fa-IR, fi-FI, fr-CA, fr-FR, gl-ES, he-IL, hi-IN, hr-HR, hu-HU, hy-AM, id-ID, is-IS, it-IT, ja-JP, km-KH, ko-KR, la, lij-IT, lt-LT, lv-LV, mn-MN, ms-MY, nb-NO, nl-NL, nn-NO, pa-PK, pl-PL, pt-BR, pt-PT, ro-RO, ru-RU, sk-SK, sl-SI, sr-Cyrl-RS, sr-Latn-RS, sv-SE, th-TH, tl-PH, tr-TR, uk-UA, vi-VN, zh-CN, zh-TW. Each language code (`fr`, `de`, `pt`, …) names its primary dialect's pack.

## Source and license

The locale data is the work of the [Citation Style Language](https://citationstyles.org/) project and its translators: the official [CSL locale files](https://github.com/citation-style-language/locales), vendored unchanged at commit `8bef426f89f38c0789223c50e53ec2197bc50bb3` (2026-10-20) in [`@citestyle/compiler`](../compiler)'s `locales/`, which resolves a style's default locale from the same files. They are licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported license](https://creativecommons.org/licenses/by-sa/3.0/) (CC BY-SA 3.0), and so are the packs made from them: each pack converts one or two of those files (a dialect merged over its primary dialect) into JSON. Every module keeps its files' rights notice and translators in a `/*! … */` comment, which minifiers keep by default; `index.json` lists them for the JSON files.

The package's own code is MIT-licensed; its `package.json` says `MIT AND CC-BY-SA-3.0`.

To update the locale files: copy `locales-*.xml` and `locales.json` from a newer commit of the CSL locales repository into `packages/compiler/locales/`, record the commit in its `source.json`, then run `node build.js` and the tests.
