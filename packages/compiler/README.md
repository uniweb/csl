# @citestyle/compiler

Transform any [CSL](https://citationstyles.org/) style into a lightweight JavaScript module at build time. The compiled output is a self-contained ES module (~3-5KB) that formats citations and bibliographies as pure function calls — no XML parsing, no runtime interpreter, no dependencies beyond `@citestyle/core`.

This is a **build tool**. Install it as a dev dependency, compile your styles once, and ship only the tiny output modules to production.

## Installation

```bash
npm install -D @citestyle/compiler
```

## CLI

### Compile a style

```bash
# Compile to a file
npx citestyle compile apa.csl -o apa.js

# Compile with another default locale (the compiler ships en-US, en-GB, de-DE, pt-BR)
npx citestyle compile apa.csl --locale de-DE -o apa-de.js

# Batch compile every .csl file in a directory
npx citestyle compile styles/*.csl -o dist/

# Multi-locale (one output file per locale)
npx citestyle compile apa.csl --locale en-US,de-DE -o dist/

# CommonJS output
npx citestyle compile apa.csl --format cjs -o apa.cjs

# Print to stdout (pipe to other tools)
npx citestyle compile apa.csl
```

### Validate without compiling

```bash
# Check a style for warnings without generating output
npx citestyle check apa.csl

# Batch validate
npx citestyle check styles/*.csl
```

### CLI options

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file or directory | stdout |
| `--locale <lang>` | The style's default locale(s), comma-separated: what it formats with when no locale pack is passed | The style's `default-locale`, else `en-US` |
| `--format <esm\|cjs>` | Output module format | `esm` |

## Using a compiled style

The compiled module exports pure functions. No registry needed for basic formatting:

```javascript
import * as apa from './apa.js'

const item = {
  id: '1',
  type: 'article-journal',
  title: 'Deep learning for citation analysis',
  author: [{ family: 'Smith', given: 'Jane' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature',
  volume: '620',
  page: '100-108',
  DOI: '10.1038/example',
}

// Bibliography entry — returns structured output, not a flat string
const entry = apa.bibliography(item)
entry.text  // Smith, J. (2024). Deep learning for citation analysis. Nature, 620, 100–108. https://doi.org/10.1038/example
entry.html  // Semantic HTML with <i>, CSS classes (.csl-author, .csl-title, ...), linked DOI
entry.parts // { authors, year, title, container, doi, ... }
entry.links // { doi: 'https://doi.org/10.1038/example' }

// Inline citation
const cite = apa.citation([{ item }])
cite.text   // (Smith, 2024)

// Style metadata
apa.meta.title  // "American Psychological Association 7th edition"
apa.meta.class  // "in-text"
```

For documents with multiple citations (where you need numbering, disambiguation, and sorting), use [`@citestyle/registry`](../registry).

### In another language

One compiled style formats in every language. Pass a locale pack from [`@citestyle/locales`](../locales) as `locale`:

```javascript
import fr from '@citestyle/locales/fr-FR'

apa.bibliography(item, { locale: fr }).text
// Smith, J. (2024). Deep learning for citation analysis. Nature, 620, 100‑108. https://doi.org/10.1038/example
apa.citation([{ item }], { locale: fr })
items.sort((a, b) => apa.bibliographySort(a, b, { locale: fr })) // sort keys in French too
```

The style resolves the pack once (CSL's locale fallback: its own `<locale>` elements over the pack, the pack over en-US) and keeps the result. Without `locale` it formats in its default locale, which `--locale` sets at compile time.

## Programmatic API

```javascript
import { compile, parse, resolveLocale, generate, readLocaleFile, readLocaleLayer } from '@citestyle/compiler'
```

### `compile(cslXml, options?)`

Full pipeline: CSL XML string to JavaScript module source.

```javascript
import { readFileSync, writeFileSync } from 'node:fs'
import { compile } from '@citestyle/compiler'

const cslXml = readFileSync('apa.csl', 'utf-8')
const { code, meta } = compile(cslXml, { locale: 'en-US' })

writeFileSync('apa.js', code)

console.log(meta.title) // "American Psychological Association 7th edition"
console.log(meta.class) // "in-text"
```

**Options:**
- `locale` (string) — The style's default locale, inlined as what it formats with when no locale pack is passed (default: the style's `default-locale`, else `'en-US'`)
- `format` (`'esm'` | `'cjs'`) — Output format (default: `'esm'`)

**Returns:** `{ code: string, meta: { id, title, class, version, defaultLocale } }`

### `parse(cslXml)`

Parse CSL XML into an AST without generating code. Useful for validation, inspection, or building custom tooling.

```javascript
const ast = parse(cslXml)
console.log(ast.info.title)
console.log(Object.keys(ast.macros))
```

### `resolveLocale(locale, overrides?)`

Resolve the style's default locale at compile time by merging: style-level term overrides → locale XML file → en-US fallback.

```javascript
const locale = resolveLocale('fr-FR', ast.localeOverrides)
```

### `generate(ast, locale, options?)`

Generate JavaScript module source from a parsed AST and resolved locale. Use this when you need control over the parse and locale resolution steps separately.

```javascript
const ast = parse(cslXml)
const locale = resolveLocale('en-US', ast.localeOverrides)
const code = generate(ast, locale, { format: 'esm' })
```

### `readLocaleFile(xml)` and `readLocaleLayer(element)`

Read a CSL locale file, or a `<locale>` DOM element, into a locale layer: the data a style reads at format time, in the shape of an `@citestyle/locales` pack (terms exactly as written, gender-form variants, `match`, nouns' genders, date formats, options). `readLocaleFile` also returns the file's translators, rights and update date.

```javascript
const { layer, info } = readLocaleFile(readFileSync('locales-fr-FR.xml', 'utf-8'))
layer.terms['open-quote'] // "« "
```

## What gets compiled

Every CSL construct maps directly to JavaScript:

| CSL XML | Compiled output |
|---|---|
| `<macro name="author">` | `function macro_author(item, ctx) { ... }` |
| `<choose><if type="article-journal">` | `if (item.type === 'article-journal')` |
| `<names variable="author">` | `formatNames(item.author, { /* config baked in */ })` |
| `<group delimiter=", ">` | Array collect → filter empties → join |
| Locale terms (`"et al."`, `"Retrieved from"`) | Read at format time: the en-US terms the style can reach, its own `<locale>` elements and its default resolution are inlined as data |

The result is a module that exports `bibliography()`, `citation()`, `bibliographySort()`, and `meta` — pure functions with no XML and no interpretation. A locale pack passed at format time is merged over the style's locale data once and cached.

## Compatibility

44 styles from the [official CSL repository](https://github.com/citation-style-language/styles) have been compiled and verified, spanning author-date, numeric, note, and label citation formats across English, German, Portuguese, French, and Spanish locales.
