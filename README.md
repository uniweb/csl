# Citestyle

**Compile citation styles, don't interpret them.**

A build-time compiler that transforms standard [Citation Style Language](https://citationstyles.org/) (`.csl`) files into lightweight JavaScript modules with structured, web-native output.

```javascript
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const registry = createRegistry(apa)
registry.addItems(references)

// Structured output — not a flat string
const entries = registry.getBibliography()
// entries[0].html  → semantic HTML with CSS classes and clickable DOI links
// entries[0].parts → { authors, year, title, container, doi, ... }
// entries[0].text  → plain text for copy-paste
```

~9-13KB total. Any of the 10,000+ community CSL styles. No runtime XML interpreter.

## The problem

Citation formatting on the web is stuck between two bad options:

1. **citeproc-js** — The reference CSL implementation. A ~120KB monolithic interpreter that parses XML at runtime, produces flat strings, and was designed for word-processor plugins — not the web.

2. **Hand-written formatters** — Tiny bundles, but every new style means hundreds of lines of code. Can't leverage the 10,000+ community-maintained CSL styles.

**Citestyle is a third option**: take those 10,000+ standard styles and compile them into small, fast JS modules at build time. No runtime interpreter. No XML parsing. No hand-writing formatters.

Think **Tailwind CSS** — a declarative specification compiled into optimized, tree-shakable code. But where Tailwind compiles utility classes to CSS, we compile formatting rules to JavaScript.

### Who this is for

- **Academic websites and portfolios** — publication lists, CV pages, research profiles
- **Documentation sites** — technical writing with proper citations
- **Digital humanities projects** — archives, bibliographies, reading lists
- **Web-first academic publishing** — journals, conferences, preprint sites
- **Any web project** that needs citation formatting without a 120KB runtime

This targets the medium where most academic content is actually consumed today: the web. It does not target journal-submission formatting, where citeproc-js's edge-case compliance matters more.

## What you get

### Tiny bundles

| | citeproc-js | Citestyle |
|---|---|---|
| First style | ~120KB + locale XML | ~9-13KB (core + style) |
| Each additional style | ~0 (shared engine) | ~3-5KB |
| Total for 3 styles | ~120KB | ~15-23KB |

For most sites (1-2 styles), the compiled approach is **an order of magnitude smaller**.

### Structured output

Existing CSL processors return a flat string. Citestyle returns structured data:

```javascript
const entry = registry.getBibliography()[0]

entry.html
// → <span class="csl-entry">
//     <span class="csl-author">Smith, J. A.</span>
//     <span class="csl-year">(2024)</span>.
//     <span class="csl-title">A study of citation formatting</span>.
//     <i class="csl-container">Journal of Examples</i>, ...
//     <a class="csl-doi" href="https://doi.org/10.1234/example">...</a>
//   </span>

entry.parts
// → { authors: [{ family: 'Smith', given: 'J. A.' }],
//     year: '2024', title: '...', container: '...', doi: '...' }

entry.links
// → { doi: 'https://doi.org/10.1234/example' }

entry.text
// → 'Smith, J. A. (2024). A study of citation formatting. ...'
```

This enables things flat strings can't:

- **Style with CSS** — `.csl-author`, `.csl-title`, `.csl-container` are real DOM elements
- **Render as cards** — use `parts` to build publication cards, profiles, CVs
- **Automatic linking** — DOIs, URLs, ORCIDs become clickable without regex post-processing
- **Accessible by default** — semantic HTML, not a blob of text
- **Searchable** — `parts` provides structured data for indexing and filtering

### Any standard CSL style

The compiler reads standard `.csl` files from the [official CSL styles repository](https://github.com/citation-style-language/styles). Your institution's custom style? If it's valid CSL, it compiles.

```bash
npx citestyle my-university.csl -o my-university.js
```

## Quick start

### Install

```bash
npm install @citestyle/core @citestyle/registry @citestyle/styles
```

`@citestyle/styles` ships the 10 most popular styles pre-compiled. For custom or less common styles, use the compiler.

### Basic usage

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

// Bibliography
const entries = registry.getBibliography()
// → [{ html, parts, links, text }]

// Inline citation
const cite = registry.cite([{ id: 'smith2024', locator: '42', label: 'page' }])
// → { html: '(Smith, 2024, p. 42)', text: 'Smith, 2024, p. 42' }
```

### Compile a custom style

```bash
npm install -D @citestyle/compiler

npx citestyle chicago-fullnote-bibliography.csl --locale en-US -o chicago.js
```

```javascript
import * as chicago from './chicago.js'
const registry = createRegistry(chicago)
```

### From BibTeX

```javascript
import { parseBibtex } from '@citestyle/bibtex'

const items = parseBibtex(bibtexString)
registry.addItems(items)

const bibliography = registry.getBibliography()
```

### From RIS

```javascript
import { parseRis } from '@citestyle/ris'

const items = parseRis(risString)
registry.addItems(items)

const bibliography = registry.getBibliography()
```

### Quick one-off formatting (no registry)

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

## Web display styles

All 10,000+ existing citation styles were designed for print. On the web, a DOI that takes half a line as plain text should be a button. A 200-item publication page needs filterable cards, not a wall of formatted strings. And modern scholarship produces artifacts — code, datasets, slides, recorded talks — that print-era formats can't represent.

Citestyle introduces a **two-layer separation**:

```
Layer 1: CSL Style (compiled)    → WHAT to show (fields, order, punctuation)
Layer 2: Web Display Style       → HOW to show it (layout, interaction, density)
```

The CSL style ensures academic correctness (APA puts the year after the author, MLA at the end). The web display style controls presentation (card vs. inline, which links get buttons, what expands on click). These are independent choices — use APA formatting with card layout, or MLA formatting with compact layout.

### `compact` — Enhanced bibliography list

The default. Like a traditional reference list, but with web enhancements.

```
Smith, J. A., & Jones, B. C. (2024). A study of citation
formatting. Journal of Examples, 12(3), 45–67.  [DOI] [PDF]
```

DOIs become linked badges instead of raw URLs. Asset links (PDF, code, data) appear as icon buttons. Hover on author names for affiliations.

### `card` — Publication cards

Structured cards for publication pages, research profiles, CVs.

```
┌──────────────────────────────────────────────────┐
│  A Study of Citation Formatting                  │
│  Smith, J. A. · Jones, B. C.        2024         │
│  Journal of Examples, 12(3)                      │
│                                                  │
│  [DOI]  [PDF]  [Code]  [Slides]  [BibTeX]        │
│                                                  │
│  ▸ Abstract                                      │
└──────────────────────────────────────────────────┘
```

Title as heading. Authors as clickable chips. Asset links as icon buttons. Expandable abstract. The CSL style is still used for copy-to-clipboard text.

### `minimal` — Dense list

Maximum density for CVs and grant applications.

```
Smith & Jones (2024). A study of citation formatting.
  J. Examples 12(3). ↗
```

### `rich` — Full detail

Everything visible: abstract, keywords, affiliations, open-access badge, all asset links, multiple citation export formats (APA, BibTeX, RIS). For research portals and lab websites.

## Extended metadata

Modern papers come with code repos, datasets, slides, recorded talks, preprints — artifacts that CSL-JSON was never designed to represent. Citestyle defines extended fields that web display styles can render:

```javascript
{
  // Standard CSL-JSON fields (unchanged)
  DOI: '10.1234/example',
  title: 'A study of citation formatting',

  // Extended: modern scholarship artifacts
  code_url: 'https://github.com/author/study',
  data_url: 'https://zenodo.org/record/12345',
  slides_url: 'https://speakerdeck.com/author/study',
  video_url: 'https://youtube.com/watch?v=...',
  preprint_url: 'https://arxiv.org/abs/2024.12345',

  // Extended: scholarly context
  open_access: 'gold',
  awards: ['Best Paper'],
  keywords: ['citations', 'formatting', 'web']
}
```

Compiled CSL styles ignore extended fields (they only use standard CSL fields for formatting correctness). Web display styles consume them for asset buttons, badges, and expandable sections.

## How it compares

| | citeproc-js | citeproc-rs | Citation.js | **Citestyle** |
|---|---|---|---|---|
| **Architecture** | Runtime interpreter | WASM interpreter | citeproc-js wrapper | **Build-time compiler** |
| **Bundle** | ~120KB + locale | ~200KB+ WASM | ~50KB + deps | **~9-13KB first style** |
| **Styles** | 10,000+ | 10,000+ (incomplete) | 10,000+ | **Any .csl file** |
| **Output** | Flat string | Flat string | Flat string | **HTML + parts + links** |
| **Auto-linking** | No | No | No | **Yes** |
| **Tree-shakable** | No | No | Partially | **Yes** |
| **Web display modes** | None | None | None | **compact, card, minimal, rich** |

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
│               (html + parts + links + text)           │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    I/O LAYER                         │
│                                                      │
│  @citestyle/bibtex  @citestyle/ris  @citestyle/doi   │
│  BibTeX ↔ CSL-JSON         DOI → CSL-JSON            │
└─────────────────────────────────────────────────────┘
```

### Packages

| Package | Purpose | Size |
|---|---|---|
| `@citestyle/compiler` | CSL XML → JS compiler (build tool) | Dev dependency |
| `@citestyle/core` | Shared runtime helpers (name/date formatting, text-case) | ~6-8KB |
| `@citestyle/registry` | Citation state (year-suffixes, numbering, sorting) | ~5-8KB |
| `@citestyle/styles` | Pre-compiled popular styles | ~3-5KB each |
| `@citestyle/bibtex` | BibTeX ↔ CSL-JSON parser/serializer | Optional |
| `@citestyle/ris` | RIS ↔ CSL-JSON parser/serializer | Optional |
| `@citestyle/types` | TypeScript type definitions | Dev dependency |

### What the compiler does

The compiler reads a `.csl` XML file and emits a JavaScript module. Each CSL construct maps to JS:

| CSL | Compiled JS |
|---|---|
| `<macro name="author">` | `function macro_author(item, ctx) { ... }` |
| `<choose><if type="article-journal">` | `if (item.type === 'article-journal')` |
| `<names variable="author">` | `formatNames(item.author, { /* config baked in */ })` |
| `<group delimiter=", ">` | Array collect → filter empties → join |
| `<text variable="title" font-style="italic">` | `<i>${escapeHtml(item.title)}</i>` |
| Locale terms (`"et al."`, month names) | Inlined string constants |

The compiled module exports `bibliography()`, `citation()`, and `bibliographySort()` — pure functions that take CSL-JSON items and return structured output.

## CSL coverage

**Full support**: text output, conditionals, macros, groups (with suppression), names (et-al, particles, ordering, substitute, name-part formatting), dates (localized, ranges, seasons), numbers (ordinal, roman), labels, formatting (italic, bold, small-caps, underline), affixes, text-case (with nocase span protection), sorting, page ranges, year suffixes, subsequent-author-substitute, name disambiguation (5 rules), cite collapsing (numeric + author-date), BibTeX/RIS import/export. 20 styles compile and pass integration tests; 44 styles stress-tested.

**Deferred** (low value for web): ibid/subsequent position, near-note distance, CSL-M extensions.

This covers the vast majority of real-world styles. The deferred features are footnote-centric — on the web, links resolve ambiguity and footnote styles are rare.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **v0.1** | CSL parser, core codegen, first compiled style (APA) | Done |
| **v0.2** | Multi-style, structured output, CSL test suite | Done |
| **v0.3** | Registry, semantic HTML, compiler gaps | Done |
| **v0.4** | 10 styles, year-suffix, second-field-align | Done |
| **v0.5** | Nocase spans, cite collapsing, 15 styles | Done |
| **v0.6** | Name disambiguation, author-date collapsing, 20 styles | Done |
| **v0.7** | BibTeX/RIS parsers, CLI improvements | Done |
| **v0.8** | TypeScript types, exports, stress testing, docs | Done |
| **v1.0** | Pre-compiled styles package, `compact` + `card` display styles | Next |

## Inspiration

- **Tailwind CSS** — Declarative vocabulary compiled to optimized output. Import only what you use.
- **GraphQL codegen** — Schema to typed, efficient runtime code with no interpretation overhead.
- **Shiki** — Standard grammar format (TextMate) with a better engine beats hand-written grammars. We take the same lesson with CSL, but go further — the style compiles away entirely instead of being interpreted at runtime.
- **SWC / esbuild** — The broader pattern: making it a build step consistently delivers order-of-magnitude improvements.

## Contributing

The architecture is modular — each package is independent:

- **Add CSL features**: Extend the compiler's codegen for new CSL elements
- **Add styles**: Pre-compile additional popular styles for `@citestyle/styles`
- **Add parsers**: New I/O modules (RIS, DOI, CrossRef)
- **Add display styles**: New web display modes beyond the initial four
- **Report edge cases**: The CSL test suite (~654 fixtures) catches most issues, but real-world styles surface new ones

## License

MIT
