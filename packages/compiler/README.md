# @citestyle/compiler

Build-time compiler that transforms [CSL](https://citationstyles.org/) XML files into lightweight JavaScript modules.

## Installation

```bash
npm install @citestyle/compiler
```

## CLI Usage

### Compile a style

```bash
# Single file to stdout
citestyle compile apa.csl

# Single file to output
citestyle compile apa.csl -o apa.js

# Batch compile all .csl files in a directory
citestyle compile styles/*.csl -o dist/

# With a specific locale
citestyle compile apa.csl --locale fr-FR -o apa-fr.js

# Multi-locale (outputs one file per locale)
citestyle compile apa.csl --locale en-US,fr-FR -o dist/

# CommonJS output
citestyle compile apa.csl --format cjs -o apa.cjs
```

### Validate a style

```bash
# Check without compiling — reports warnings
citestyle check apa.csl

# Batch validate
citestyle check styles/*.csl
```

### CLI Options

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file or directory | stdout |
| `--locale <lang>` | Target locale, comma-separated for multi-locale | `en-US` |
| `--format <esm\|cjs>` | Output module format | `esm` |

## Programmatic API

```js
import { compile, parse, resolveLocale, generate } from '@citestyle/compiler'
```

### `compile(cslXml, options?)`

Full pipeline: XML string to JavaScript module.

```js
import { readFileSync } from 'node:fs'

const cslXml = readFileSync('apa.csl', 'utf-8')
const { code, meta } = compile(cslXml, { locale: 'en-US' })

console.log(meta.title) // "American Psychological Association 7th edition"
console.log(meta.class) // "in-text"

// `code` is a complete ES module string — write it to a file
writeFileSync('apa.js', code)
```

**Parameters:**
- `cslXml` (string) -- CSL XML source
- `options.locale` (string) -- Target locale (default: style's default or `'en-US'`)
- `options.format` (`'esm'` | `'cjs'`) -- Output format (default: `'esm'`)

**Returns:** `{ code: string, meta: { id, title, class, version, defaultLocale } }`

### `parse(cslXml)`

Parse CSL XML into an AST. Useful for validation or inspection without code generation.

```js
const ast = parse(cslXml)
console.log(ast.info.title)
console.log(Object.keys(ast.macros))
```

### `resolveLocale(locale, overrides?)`

Resolve locale data by merging: style-level overrides, locale XML file, and en-US fallback.

```js
const locale = resolveLocale('fr-FR', ast.localeOverrides)
```

### `generate(ast, locale, options?)`

Generate JavaScript module source from a parsed AST and resolved locale.

```js
const ast = parse(cslXml)
const locale = resolveLocale('en-US', ast.localeOverrides)
const code = generate(ast, locale, { format: 'esm' })
```

## Using a Compiled Style

```js
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

// Format a bibliography entry
const entry = apa.bibliography(item)
console.log(entry.text)
// Smith, J. (2024). Deep learning for citation analysis. Nature, 620, 100–108.
console.log(entry.html)
// Semantic HTML with <i>, CSS classes, linked DOI

// Format an inline citation
const citation = apa.citation([{ item }])
console.log(citation.text) // (Smith, 2024)
```
