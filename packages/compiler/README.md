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

# Compile with a specific locale
npx citestyle compile apa.csl --locale fr-FR -o apa-fr.js

# Batch compile every .csl file in a directory
npx citestyle compile styles/*.csl -o dist/

# Multi-locale (one output file per locale)
npx citestyle compile apa.csl --locale en-US,fr-FR -o dist/

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
| `--locale <lang>` | Target locale(s), comma-separated | `en-US` |
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
entry.text  // Smith, J. (2024). Deep learning for citation analysis. Nature, 620, 100–108.
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

## Programmatic API

```javascript
import { compile, parse, resolveLocale, generate } from '@citestyle/compiler'
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
- `locale` (string) — Target locale (default: style's default or `'en-US'`)
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

Resolve locale data by merging: style-level term overrides → locale XML file → en-US fallback.

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

## What gets compiled

Every CSL construct maps directly to JavaScript:

| CSL XML | Compiled output |
|---|---|
| `<macro name="author">` | `function macro_author(item, ctx) { ... }` |
| `<choose><if type="article-journal">` | `if (item.type === 'article-journal')` |
| `<names variable="author">` | `formatNames(item.author, { /* config baked in */ })` |
| `<group delimiter=", ">` | Array collect → filter empties → join |
| Locale terms (`"et al."`, `"Retrieved from"`) | Inlined string constants |

The result is a module that exports `bibliography()`, `citation()`, `bibliographySort()`, and `meta` — pure functions with no XML, no interpretation, and no runtime locale resolution.

## Compatibility

44 styles from the [official CSL repository](https://github.com/citation-style-language/styles) have been compiled and verified, spanning author-date, numeric, note, and label citation formats across English, German, Portuguese, French, and Spanish locales.
