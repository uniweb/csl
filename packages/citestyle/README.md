# Citestyle

**Citation formatting for the web.** Format references in any of 10,000+ citation styles with structured, web-native output — semantic HTML, decomposed parts, extracted links, and plain text — all from a ~9KB runtime.

```bash
npm install citestyle
```

```javascript
import { format } from 'citestyle'
import * as apa from 'citestyle/styles/apa'

const entry = format(apa, {
  type: 'article-journal',
  title: 'Structured citation output for the web',
  author: [{ family: 'Smith', given: 'J. A.' }, { family: 'Doe', given: 'Jane' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Journal of Digital Publishing',
  volume: '8',
  page: '123-145',
  DOI: '10.1234/jdp.2024.001'
})

entry.text   // Smith, J. A., & Doe, J. (2024). Structured citation output ...
entry.html   // Semantic HTML with per-field CSS classes and clickable DOI links
entry.parts  // { authors, year, title, container, volume, pages, doi, ... }
entry.links  // { doi: 'https://doi.org/10.1234/jdp.2024.001' }
```

One function call, four representations. Every formatted entry gives you:

- **`html`** — Semantic HTML where every field (`.csl-author`, `.csl-title`, `.csl-container`) is a real element you can style with CSS. DOIs and URLs become clickable links automatically.
- **`text`** — Clean plain text for copy-paste, clipboard, and accessibility.
- **`parts`** — Decomposed fields (`authors`, `year`, `title`, `container`, `doi`, …) for building publication cards, research profiles, CVs, or any custom layout.
- **`links`** — Extracted DOIs, URLs, and PDFs for linking without post-processing.

```html
<!-- entry.html -->
<span class="csl-entry">
  <span class="csl-author">Smith, J. A., &amp; Doe, J.</span>
  <span class="csl-year">(2024)</span>.
  <span class="csl-title">Structured citation output for the web</span>.
  <i class="csl-container">Journal of Digital Publishing</i>,
  <span class="csl-volume">8</span>, <span class="csl-pages">123–145</span>.
  <a class="csl-doi" href="https://doi.org/10.1234/jdp.2024.001">https://doi.org/…</a>
</span>
```

Existing citation processors return flat strings — you get a blob of text and have to regex out the parts. Citestyle gives you structure from the start.

## How it works

Most citation formatters ship a runtime interpreter that parses style definitions on every page load. Citestyle takes a different approach: it **compiles** [Citation Style Language](https://citationstyles.org/) (CSL) definitions into optimized JavaScript at build time. The style *becomes* the code — no interpreter, no XML parsing at runtime.

The same approach behind Tailwind CSS (utility classes → optimized CSS) and GraphQL codegen (schemas → typed runtime code), applied to citation formatting.

**Standard styles.** The compiler reads standard `.csl` files from the [official CSL repository](https://github.com/citation-style-language/styles) — the same 10,000+ community-maintained styles that Zotero, Mendeley, and every other reference manager uses. Your institution's custom style, an obscure journal format — if it's valid CSL, it compiles.

**Tree-shaking at two levels.** Each compiled style is a standalone ES module. Import APA and not MLA → MLA is never in your bundle. But it goes deeper: each compiled style only imports the specific core helpers it uses. A style with no date formatting doesn't pull in `formatDate`. An interpreter can't do this — it must ship the entire formatting engine because it doesn't know which style will be loaded at runtime. The shared runtime is ~6-8KB; each compiled style adds ~3-5KB. Your first style ships in ~9-13KB total.

**Locale terms inlined as constants.** An interpreter loads locale XML (~20KB) as a separate file at runtime — month names, ordinal suffixes, "et al.", "and", punctuation rules. Citestyle resolves all locale terms at compile time and inlines them as string constants. No runtime locale loading, no extra file to fetch. A compiled style for en-US has the terms literally in the code.

**Pure functions.** `format(style, item)` has no side effects, no global state, no initialization step. Same input, same output. Works in browsers, Node, edge functions, workers, SSR — anywhere JavaScript runs. The registry is the only stateful piece, and it's opt-in for when you need cross-reference features.

**Null safety from group suppression.** Real-world citation data is messy — missing DOIs, no volume number, no editor. CSL handles this through group suppression: if every variable a group references is empty, the entire group — including its delimiters and surrounding punctuation — is suppressed. No dangling commas, no orphaned parentheses, no "undefined" in output. The compiler emits the right conditional structure so this works automatically for any data shape.

**Debuggable output.** The compiled JavaScript is readable. When formatting looks wrong, you can open the compiled file and trace exactly which CSL rule produced which output. Stack traces point to the actual formatting logic, not into an XML interpreter.

## Quick start

### Format one reference

```javascript
import { format } from 'citestyle'
import * as apa from 'citestyle/styles/apa'

const entry = format(apa, item)
// → { html, text, parts, links }
```

### Format a list

Sort, number, and format multiple items in one call:

```javascript
import { formatAll } from 'citestyle'
import * as ieee from 'citestyle/styles/ieee'

const entries = formatAll(ieee, items)
// Sorted per IEEE rules, citation numbers assigned
// → [{ html, text, parts, links }, ...]
```

### Format inline citations

```javascript
import { formatCitation } from 'citestyle'
import * as apa from 'citestyle/styles/apa'

const cite = formatCitation(apa, [
  { item: smithItem, locator: '42', label: 'page' }
])
// → { html: '(Smith, 2024, p. 42)', text: '(Smith, 2024, p. 42)' }
```

### Documents with cross-references

When citations interact across a document — year-suffix disambiguation (2024a, 2024b), name disambiguation, cite collapsing — use a registry:

```javascript
import { createRegistry } from 'citestyle'
import * as apa from 'citestyle/styles/apa'

const registry = createRegistry(apa)
registry.addItems(references)

const entries = registry.getBibliography()   // sorted, disambiguated
const cite = registry.cite([{ id: 'smith2024' }, { id: 'jones2023' }])
```

The registry handles year-suffix assignment, name disambiguation (5 rules), bibliography sorting, citation numbering for numeric styles, cite collapsing (`[1-3]` instead of `[1, 2, 3]`), and subsequent-author-substitute. When you don't need these features, `format()` and `formatAll()` are simpler.

### Import from BibTeX

```javascript
import { parseBibtex, format } from 'citestyle'
import * as apa from 'citestyle/styles/apa'

const items = parseBibtex(bibtexString)
const entry = format(apa, items[0])
```

## Pre-compiled styles

Nine widely used styles ship pre-compiled:

```javascript
import * as apa from 'citestyle/styles/apa'                    // APA 7th edition
import * as mla from 'citestyle/styles/mla'                    // MLA 9th edition
import * as chicago from 'citestyle/styles/chicago-author-date' // Chicago 17th (author-date)
import * as ieee from 'citestyle/styles/ieee'                  // IEEE
import * as vancouver from 'citestyle/styles/vancouver'        // Vancouver
import * as harvard from 'citestyle/styles/harvard'            // Harvard (Cite Them Right)
import * as ama from 'citestyle/styles/ama'                    // AMA 11th edition
import * as nature from 'citestyle/styles/nature'              // Nature
import * as science from 'citestyle/styles/science'            // Science (AAAS)
```

Need a different style? Compile any `.csl` file:

```bash
npm install -D @citestyle/compiler
npx citestyle compile chicago-fullnote-bibliography.csl -o chicago-notes.js
```

```javascript
import { format } from 'citestyle'
import * as chicagoNotes from './chicago-notes.js'
const entry = format(chicagoNotes, item)
```

## Testing

Citestyle is tested against the [official CSL test suite](https://github.com/citation-style-language/test-suite) — 66 fixtures covering the spec's formatting constructs (names, dates, conditionals, groups, sorting, text-case, disambiguation, collapsing). Beyond the test suite, 44 real-world styles have been compiled and stress-tested against reference data, spanning disciplines from psychology (APA) to law (Bluebook) to medicine (Vancouver, BMJ, AMA, PLOS) to chemistry (ACS) to German (DGPs) and Portuguese (ABNT) academic conventions.

420 automated tests cover the full API surface: the compiler, the core formatting engine, the citation registry, and the BibTeX and RIS parsers.

CSL spec coverage is comprehensive for web use cases — the complete rendering model (text, macros, conditionals, groups with suppression, names with et-al and particles, dates with ranges and seasons, numbers, labels, formatting, affixes, text-case with nocase protection, sorting, page ranges), plus cross-reference features (year-suffix disambiguation, name disambiguation with 5 rules, cite collapsing, subsequent-author substitute). Footnote-centric features (ibid, subsequent position) are deferred — they target print and word-processor workflows, not the web.

## How it compares

| | citeproc-js | citeproc-rs | Citation.js | **Citestyle** |
|---|---|---|---|---|
| **Architecture** | Runtime interpreter | WASM interpreter | Runtime interpreter | **Build-time compiler** |
| **Bundle** | ~120KB + locale XML | ~200KB+ WASM | ~50KB + deps | **~9-13KB** |
| **Output** | Flat string | Flat string | Flat string | **HTML + text + parts + links** |
| **Auto-linking** | No | No | No | **DOIs and URLs** |
| **CSS classes** | No | No | No | **Per-field** |
| **Tree-shakable** | No | No | Partially | **Yes** |
| **TypeScript** | No | N/A | Partial | **Full** |

## Packages

`citestyle` bundles the common use case: core runtime, registry, pre-compiled styles, and BibTeX parsing. For finer control, install scoped packages directly:

| Package | What it does | When to install separately |
|---|---|---|
| [`@citestyle/core`](https://www.npmjs.com/package/@citestyle/core) | Shared formatting runtime (~6-8KB) | Building a custom formatter on the low-level API |
| [`@citestyle/registry`](https://www.npmjs.com/package/@citestyle/registry) | Citation state (~5-8KB) | Need the registry without BibTeX parsing |
| [`@citestyle/styles`](https://www.npmjs.com/package/@citestyle/styles) | 9 pre-compiled styles (~3-5KB each) | Only need styles + core, nothing else |
| [`@citestyle/bibtex`](https://www.npmjs.com/package/@citestyle/bibtex) | BibTeX ↔ CSL-JSON | Only need BibTeX conversion |
| [`@citestyle/ris`](https://www.npmjs.com/package/@citestyle/ris) | RIS ↔ CSL-JSON | Working with PubMed/RIS data |
| [`@citestyle/compiler`](https://www.npmjs.com/package/@citestyle/compiler) | CSL XML → JS compiler | Compiling custom `.csl` files |
| [`@citestyle/types`](https://www.npmjs.com/package/@citestyle/types) | TypeScript type definitions | Type-only imports for TS projects |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BUILD TIME                        │
│                                                     │
│  apa.csl ──→ Citestyle Compiler ──→ apa.js (~3-5KB) │
│  Locale terms resolved and inlined as constants     │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                     RUNTIME                         │
│                                                     │
│  @citestyle/core (~6-8KB)                           │
│  Names · dates · text-case · numbers · HTML         │
│       ▲                       ▲                     │
│       │                       │                     │
│  Compiled Style          Registry                   │
│  (imports core)    (year-suffix, sort)               │
│       │                       │                     │
│  CSL-JSON ──→ { html, text, parts, links }          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    I/O LAYER                         │
│                                                     │
│  @citestyle/bibtex          @citestyle/ris          │
│  BibTeX ↔ CSL-JSON          RIS ↔ CSL-JSON          │
└─────────────────────────────────────────────────────┘
```

## License

MIT
