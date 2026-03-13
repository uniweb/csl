# Citestyle

**Compile citation styles, don't interpret them.**

A build-time compiler that transforms standard [Citation Style Language](https://citationstyles.org/) (`.csl`) files into lightweight JavaScript modules. Get any of the 10,000+ community CSL styles in ~9-13KB with structured, web-native output — no runtime XML interpreter.

```javascript
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const registry = createRegistry(apa)
registry.addItems(references)

const entries = registry.getBibliography()

entries[0].html   // Semantic HTML with CSS classes and clickable DOI links
entries[0].text   // Plain text for copy-paste
entries[0].parts  // { authors, year, title, container, doi, ... }
entries[0].links  // { doi: 'https://doi.org/10.1234/example' }
```

## Why Citestyle?

Citation formatting on the web is stuck between two bad options:

1. **citeproc-js** — The reference CSL implementation. ~120KB of runtime interpreter that parses XML on every page load, produces flat strings with no structure, and was designed for word-processor plugins — not the web.

2. **Hand-written formatters** — Tiny bundles, but every new style means hundreds of lines of bespoke code. Can't leverage the 10,000+ community-maintained CSL styles.

**Citestyle takes a different approach.** Like Tailwind CSS compiles utility classes into optimized CSS, Citestyle compiles formatting rules into optimized JavaScript at build time. The style *becomes* the code. No interpreter ships to the browser. No XML is parsed at runtime. Every style from the [official repository](https://github.com/citation-style-language/styles) just works.

### What you get

**10x smaller bundles.** Your first style is ~9-13KB total (core + style). Each additional style adds ~3-5KB. Compare that to ~120KB for citeproc-js before you format a single citation.

| | citeproc-js | Citestyle |
|---|---|---|
| First style | ~120KB + locale XML | ~9-13KB (core + style) |
| Each additional style | ~0 (shared engine) | ~3-5KB |
| Total for 3 styles | ~120KB | ~15-23KB |

**Structured output.** Every other CSL processor returns a flat string. Citestyle gives you four representations of every formatted entry:

```javascript
const entry = registry.getBibliography()[0]

// Semantic HTML — real DOM elements you can style with CSS
entry.html
// → <span class="csl-entry">
//     <span class="csl-author">Smith, J. A.</span>
//     <span class="csl-year">(2024)</span>.
//     <span class="csl-title">A study of citation formatting</span>.
//     <i class="csl-container">Journal of Examples</i>, ...
//     <a class="csl-doi" href="https://doi.org/10.1234/example">...</a>
//   </span>

// Decomposed fields for building custom layouts (cards, profiles, CVs)
entry.parts  // → { authors, year, title, container, doi, ... }

// Extracted links — DOIs and URLs are auto-detected and linked
entry.links  // → { doi: 'https://doi.org/10.1234/example' }

// Clean plain text for copy-paste and accessibility
entry.text   // → 'Smith, J. A. (2024). A study of citation formatting. ...'
```

This unlocks things flat strings can't do:

- **Style with CSS** — `.csl-author`, `.csl-title`, `.csl-container` are real elements, not substrings you have to regex out
- **Build custom layouts** — use `parts` for publication cards, research profiles, CVs, or any layout your design requires
- **Automatic linking** — DOIs and URLs become clickable links without post-processing
- **Accessible by default** — semantic HTML, not a blob of text

**Any standard CSL style.** The compiler reads standard `.csl` files. Your institution's custom style, an obscure journal format, a brand new style — if it's valid CSL, it compiles.

```bash
npx citestyle compile my-university.csl -o my-university.js
```

### Who this is for

- **Academic websites and portfolios** — publication lists, CV pages, research profiles
- **Documentation sites** — technical writing with proper citations
- **Digital humanities projects** — archives, bibliographies, reading lists
- **Web-first academic publishing** — journals, conferences, preprint servers
- **Any web project** that needs citation formatting without a 120KB runtime

This targets the medium where most academic content is consumed today: the web.

## Quick start

### Install

```bash
npm install @citestyle/core @citestyle/registry @citestyle/styles
```

`@citestyle/styles` ships the 10 most popular styles pre-compiled. For custom or less common styles, use the compiler.

### Format a bibliography

```javascript
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const registry = createRegistry(apa)

registry.addItems([
  {
    id: 'smith2024',
    type: 'article-journal',
    title: 'A study of citation formatting',
    author: [{ family: 'Smith', given: 'John A.' }],
    issued: { 'date-parts': [[2024]] },
    'container-title': 'Journal of Examples',
    volume: '12',
    issue: '3',
    page: '45-67',
    DOI: '10.1234/example'
  }
])

// Bibliography entries — sorted per APA rules
const entries = registry.getBibliography()
// → [{ html, text, parts, links }]

// Inline citation
const cite = registry.cite([{ id: 'smith2024', locator: '42', label: 'page' }])
// → { html: '(Smith, 2024, p. 42)', text: '(Smith, 2024, p. 42)' }
```

### One-off formatting (no registry needed)

For quick, standalone formatting without tracking cross-reference state:

```javascript
import { format, formatCitation } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

// Single bibliography entry
const entry = format(apa, item)
// → { html, text, parts, links }

// Single citation
const cite = formatCitation(apa, [{ item, locator: '42', label: 'page' }])
// → { html, text }
```

### Compile a custom style

```bash
npm install -D @citestyle/compiler

npx citestyle compile chicago-fullnote-bibliography.csl --locale en-US -o chicago.js
```

```javascript
import * as chicago from './chicago.js'
const registry = createRegistry(chicago)
```

### Import from BibTeX or RIS

Already have references in BibTeX or RIS format? Convert them to CSL-JSON in one call:

```javascript
import { parseBibtex } from '@citestyle/bibtex'

const items = parseBibtex(bibtexString)
registry.addItems(items)
```

```javascript
import { parseRis } from '@citestyle/ris'

const items = parseRis(risString)
registry.addItems(items)
```

### Validate your data

Catch common CSL-JSON mistakes before formatting:

```javascript
import { validateItem } from '@citestyle/core'

const result = validateItem(item)
// { valid: true, warnings: [] }
// or { valid: false, warnings: ['Missing required field: type'] }
```

## How it compares

| | citeproc-js | citeproc-rs | Citation.js | **Citestyle** |
|---|---|---|---|---|
| **Architecture** | Runtime interpreter | WASM interpreter | Runtime interpreter | **Build-time compiler** |
| **Bundle size** | ~120KB + locale XML | ~200KB+ WASM | ~50KB + deps | **~9-13KB** |
| **Output** | Flat string | Flat string | Flat string | **HTML + parts + links** |
| **Auto-linking** | No | No | No | **DOIs, URLs** |
| **CSS styling** | No | No | No | **Per-field classes** |
| **Tree-shakable** | No | No | Partially | **Yes** |
| **Styles** | 10,000+ | 10,000+ | 10,000+ | **Any .csl file** |
| **TypeScript** | No | N/A | Partial | **Full types** |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BUILD TIME                        │
│                                                      │
│  apa.csl ──→ Citestyle Compiler ──→ apa.js           │
│  mla.csl ──→ Citestyle Compiler ──→ mla.js           │
│                                                      │
│  Locale terms inlined as string constants            │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                     RUNTIME                          │
│                                                      │
│  @citestyle/core (~6-8KB)                            │
│  Names · dates · text-case · numbers · HTML          │
│       ▲                       ▲                      │
│       │                       │                      │
│  Compiled Style          Registry                    │
│  (imports core)    (year-suffix, sort)                │
│       │                       │                      │
│  CSL-JSON ──→ FormattedEntry                         │
│               { html, text, parts, links }           │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    I/O LAYER                         │
│                                                      │
│  @citestyle/bibtex        @citestyle/ris             │
│  BibTeX ↔ CSL-JSON        RIS ↔ CSL-JSON             │
└─────────────────────────────────────────────────────┘
```

### Packages

| Package | Purpose | Size |
|---|---|---|
| [`@citestyle/compiler`](./packages/compiler) | CSL XML → JS compiler (build tool) | Dev dependency |
| [`@citestyle/core`](./packages/core) | Shared runtime helpers (names, dates, text-case, HTML) | ~6-8KB |
| [`@citestyle/registry`](./packages/registry) | Citation state (numbering, sorting, disambiguation) | ~5-8KB |
| [`@citestyle/styles`](./packages/styles) | 10 pre-compiled popular styles | ~3-5KB each |
| [`@citestyle/bibtex`](./packages/bibtex) | BibTeX ↔ CSL-JSON parser/serializer | Optional |
| [`@citestyle/ris`](./packages/ris) | RIS ↔ CSL-JSON parser/serializer | Optional |
| [`@citestyle/types`](./packages/types) | TypeScript type definitions | Dev dependency |

### What the compiler does

The compiler reads a `.csl` XML file and emits a JavaScript module. Every CSL construct maps directly to JS:

| CSL | Compiled JS |
|---|---|
| `<macro name="author">` | `function macro_author(item, ctx) { ... }` |
| `<choose><if type="article-journal">` | `if (item.type === 'article-journal')` |
| `<names variable="author">` | `formatNames(item.author, { /* config baked in */ })` |
| `<group delimiter=", ">` | Array collect → filter empties → join |
| `<text variable="title" font-style="italic">` | `<i>${escapeHtml(item.title)}</i>` |
| Locale terms (`"et al."`, month names) | Inlined string constants |

The compiled module exports `bibliography()`, `citation()`, and `bibliographySort()` — pure functions that take CSL-JSON items and return structured output. No XML. No interpretation. Just function calls.

## CSL coverage

**Full support**: text, conditionals, macros, groups (with suppression), names (et-al, particles, ordering, substitute, name-part formatting), dates (localized, ranges, seasons), numbers (ordinal, roman), labels, formatting (italic, bold, small-caps, underline), affixes, text-case (with nocase span protection), sorting, page ranges, year suffixes, subsequent-author-substitute, name disambiguation (5 rules), cite collapsing (numeric + author-date), BibTeX/RIS import/export. 20 styles compile and pass integration tests; 44 styles stress-tested.

**Deferred** (low value for web): ibid/subsequent position, near-note distance, CSL-M extensions. These are footnote-centric features — on the web, links resolve ambiguity and footnote styles are rare.

## Inspiration

- **Tailwind CSS** — Declarative vocabulary compiled to optimized output. Import only what you use.
- **GraphQL codegen** — Schema to typed, efficient runtime code with no interpretation overhead.
- **Shiki** — Standard grammar format (TextMate) with a better engine. We take the same lesson with CSL, but go further — the style compiles away entirely.
- **SWC / esbuild** — The broader pattern: making it a build step consistently delivers order-of-magnitude improvements.

## Contributing

The architecture is modular — pick a package and dive in:

- **Compiler**: Extend codegen for new CSL elements or edge cases
- **Styles**: Pre-compile additional popular styles
- **Parsers**: New I/O modules (DOI lookup, CrossRef, MODS)
- **Report issues**: The test suite catches most issues, but real-world styles surface new ones

## License

MIT
