# CSL Compiler: Web-Native Citation Formatting from Standard Styles

## Vision

A **build-time CSL compiler** that transforms standard Citation Style Language (`.csl`) files into lightweight, tree-shakable JavaScript modules — producing structured, web-native output instead of the flat strings that existing processors generate.

This is not another CSL interpreter. It's a fundamentally different execution model: **compile once, run fast**. The closest analogy is what Tailwind CSS did for styling and GraphQL codegen did for API queries — declarative specifications compiled to optimized, tree-shakable code at build time, eliminating runtime interpretation entirely. (Shiki modernized syntax highlighting by using better grammar data, but it still interprets at runtime via a WASM engine. Our approach is more radical: the style *becomes* the code.)

## Why This Matters

### The current landscape is stuck

Citation formatting on the web is dominated by two approaches, both inadequate:

1. **citeproc-js** — The reference CSL implementation. A monolithic, decade-old JavaScript file (~120KB+) that runtime-parses CSL XML, maintains a stateful registry, and produces opaque strings. It powers Zotero and Mendeley's word-processor integrations, but it was designed for desktop plugins, not the web. Every site that uses it pays the full cost regardless of how many styles they need.

2. **Hand-written formatters** — Libraries (and our own `@uniweb/scholar`) that hardcode a few popular styles (APA, MLA, Chicago, IEEE). Tiny bundles, but every new style requires writing and maintaining hundreds of lines of formatting code. They can't leverage the 10,000+ community-maintained CSL styles.

**citeproc-rs** (Zotero's Rust/WASM rewrite) is the most ambitious alternative, but it's architecturally the same — a runtime interpreter, just faster. It remains incomplete, and the WASM binary adds its own weight.

Nobody has asked the question: **what if the style itself became the code?**

### What a compiler changes

| | Runtime interpreter (citeproc-js) | Compiled styles (this project) |
|---|---|---|
| **When work happens** | Every page load | Once at build time |
| **Bundle cost** | ~120KB base + style XML + locale XML | ~3-5KB per compiled style |
| **Output** | Flat string | Structured HTML + parts + links |
| **Tree-shaking** | Impossible (monolithic) | Natural (import only styles you use) |
| **Style count** | Any (loads one style XML + engine per page) | Any — compiled on demand, no engine needed |
| **Web integration** | Afterthought (designed for word processors) | First-class (semantic HTML, CSS classes, links) |

### Who this is for

- **Academic websites and portfolios** — Publication lists, CV pages, research profiles
- **Documentation sites** — Technical writing with citations
- **Digital humanities projects** — Archives, bibliographies, reading lists
- **Web-first academic publishing** — Journals, conferences, preprint sites
- **Any web project** that needs proper citation formatting without a 120KB runtime

This is explicitly **not** targeting journal-submission formatting (where citeproc-js's edge-case compliance matters). It targets the medium where most academic content is actually consumed today: the web.

## Architecture

### Three-Layer Design

```
┌──────────────────────────────────────────────────────┐
│                    BUILD TIME                          │
│                                                        │
│  apa.csl ──→ CSL Compiler ──→ apa.js (~3-5KB)        │
│  mla.csl ──→ CSL Compiler ──→ mla.js (~3-5KB)        │
│                    │                                   │
│              Locale files ──→ inlined terms            │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    RUNTIME                             │
│                                                        │
│  ┌──────────────────────────────────────────────┐     │
│  │  @citestyle/core (~6-8KB shared helpers)           │     │
│  │  names · dates · text-case · numbers · pages │     │
│  └──────────────────────────────────────────────┘     │
│         ▲                      ▲                       │
│         │                      │                       │
│  Compiled Style            Citation Registry           │
│  (imports core)     (year-suffix, ordering, sort)      │
│         │                      │                       │
│         └──────── ctx ─────────┘                       │
│                    │                                   │
│  CSL-JSON items ──→ ──→ FormattedEntry (html+parts)   │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    I/O LAYER                           │
│                                                        │
│  BibTeX → CSL-JSON    RIS → CSL-JSON                  │
│  DOI → CSL-JSON       CrossRef API → CSL-JSON         │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    EXPORT LAYER (optional)             │
│                                                        │
│  FormattedEntry → Clipboard (plain text / rich text)  │
│  CSL-JSON → BibTeX string   CSL-JSON → RIS string     │
│  Download helper (Blob → .bib / .ris / .json)         │
└──────────────────────────────────────────────────────┘
```

### Layer 1: The Compiler (`@citestyle/compiler`)

The compiler reads a `.csl` XML file and emits a JavaScript module. The core transformation is: **CSL's declarative XML → imperative JS functions**.

#### CSL constructs → JS compilation targets

| CSL construct | Compiled output |
|---|---|
| `<macro name="author">...</macro>` | `function macro_author(item, ctx) { ... }` |
| `<choose><if type="article-journal">` | `if (item.type === 'article-journal') { ... }` |
| `<names variable="author">` | Name-formatting call with et-al config baked in |
| `<group delimiter=", ">` | Array collect + join with empty-element suppression |
| `<text variable="title" font-style="italic">` | `{ text: item.title, tag: 'i' }` or `<i>${item.title}</i>` |
| `<date variable="issued">` | Date-formatting call with locale parts inlined |
| `<label variable="page" form="short">` | Locale term lookup inlined as string constant |
| `<number variable="edition" form="ordinal">` | Ordinal formatting with locale rules baked in |
| `<sort><key macro="author"/>` | Sort comparator function referencing compiled macro |
| Locale terms ("et al.", "and", month names) | Inlined string constants (no runtime locale loading) |

#### What the compiler produces

Each compiled style module exports:

```javascript
// Generated from apa.csl — do not edit
// CSL: American Psychological Association 7th edition
// License: CC-BY-SA-3.0

export const meta = {
  id: 'apa',
  title: 'American Psychological Association 7th edition',
  class: 'in-text',          // 'in-text' or 'note'
  categories: ['psychology', 'social_science', 'generic-base'],
  locales: ['en-US'],        // locales baked into this build
  version: '1.0.2',
  compiledWith: '@citestyle/compiler@0.1.0'
}

/**
 * Format a single bibliography entry.
 * @param {CslItem} item — CSL-JSON item
 * @param {FormatContext} ctx — runtime context (position, locale, etc.)
 * @returns {FormattedEntry}
 */
export function bibliography(item, ctx) { ... }

/**
 * Format an inline citation cluster.
 * @param {CslCite[]} cites — array of { item, locator?, label? }
 * @param {FormatContext} ctx
 * @returns {FormattedCitation}
 */
export function citation(cites, ctx) { ... }

/**
 * Sort comparator for bibliography ordering.
 * @param {CslItem} a
 * @param {CslItem} b
 * @returns {number}
 */
export function bibliographySort(a, b) { ... }
```

#### Structured output (the novel part)

Existing CSL processors return flat strings:

```
Smith, J. A. (2024). A study of citation formatting. <i>Journal of Examples</i>, 12(3), 45–67. https://doi.org/10.1234/example
```

The compiler produces **structured output** — both renderable HTML and decomposed parts:

```javascript
// FormattedEntry
{
  // Ready-to-render HTML with semantic CSS classes
  html: '<span class="csl-entry">'
      + '<span class="csl-author">Smith, J. A.</span> '
      + '<span class="csl-year">(2024)</span>. '
      + '<span class="csl-title">A study of citation formatting</span>. '
      + '<i class="csl-container">Journal of Examples</i>, '
      + '<span class="csl-volume">12</span>'
      + '(<span class="csl-issue">3</span>), '
      + '<span class="csl-pages">45–67</span>. '
      + '<a class="csl-doi" href="https://doi.org/10.1234/example">https://doi.org/10.1234/example</a>'
      + '</span>',

  // Decomposed parts for custom rendering (cards, profiles, etc.)
  parts: {
    authors: [{ family: 'Smith', given: 'J. A.', formatted: 'Smith, J. A.' }],
    year: '2024',
    title: 'A study of citation formatting',
    container: 'Journal of Examples',
    volume: '12',
    issue: '3',
    pages: '45–67',
    doi: '10.1234/example',
    url: null
  },

  // Extracted links (web-native enhancement)
  links: {
    doi: 'https://doi.org/10.1234/example',
    url: null,
    pdf: null
  },

  // Plain text fallback (for copy-paste, accessibility)
  text: 'Smith, J. A. (2024). A study of citation formatting. Journal of Examples, 12(3), 45–67. https://doi.org/10.1234/example'
}
```

**Design note on `parts`:** The `parts` object is a **raw field extraction**, not a style-aware decomposition. It uses CSL variable names and provides the item's data in a convenient shape — but the *arrangement* and *formatting* of those parts is what `html` and `text` provide. Think of `parts` as structured metadata for building alternative layouts (cards, profiles), while `html`/`text` give you the style-correct formatted output. A component might use `html` for a bibliography list but `parts` for a publication card where the layout is custom.

This enables use cases that flat strings can't serve:

- **Card layouts**: Use `parts` to render publications as structured cards with custom layout
- **CSS theming**: Style `.csl-author`, `.csl-title`, `.csl-container` independently via `html`
- **Linking**: DOIs, URLs, ORCIDs become clickable automatically in `html` output
- **Accessibility**: Semantic HTML structure, not a blob of text
- **Copy-paste**: `text` provides clean plain-text for clipboard
- **Search / metadata**: `parts` provides structured data for indexing, filtering, sorting

#### Compilation pipeline

```
Input: .csl file (XML)
  │
  ├─ 1. Parse XML → CSL AST
  │     (custom parser — CSL has ~50 elements, well-defined schema)
  │
  ├─ 2. Resolve macros
  │     (inline macro bodies at call sites, detect cycles)
  │
  ├─ 3. Resolve locale terms
  │     (merge: style locale overrides → locale file → en-US fallback)
  │     (inline as string constants — no runtime locale loading)
  │
  ├─ 4. Compile AST → JS functions
  │     (each rendering element → code fragment)
  │     (conditionals → if/else chains)
  │     (groups → array collect with suppression logic)
  │     (names → formatting calls with config baked in)
  │
  ├─ 5. Emit module
  │     (bibliography function, citation function, sort comparator)
  │     (metadata, locale info, source style hash)
  │
  └─ 6. Optional: minify + tree-shake dead branches
        (remove item-type branches the user excludes via config)

Output: .js module (~3-5KB per style, locale-specific)
```

### Layer 1b: Shared Runtime Helpers (`@citestyle/core`)

Compiled styles don't inline everything — formatting functions that are complex and shared across all styles live in a small runtime library:

```javascript
// @citestyle/core — shared by all compiled styles (~6-8KB)
export { formatNames }       // Name formatting (et-al, sort-order, initialize, particles)
export { formatDate }        // Date formatting (localized parts, ranges, seasons)
export { titleCase, sentenceCase, capitalize } // Text-case transforms
export { ordinal, longOrdinal, roman }         // Number formatting
export { pageRange }         // Chicago/expanded/minimal page range algorithms
export { escapeHtml }        // HTML entity escaping for safe output
```

**Why separate from the compiled styles?** Name formatting alone involves ~1.5KB of logic (et-al truncation, `delimiter-precedes-last` modes, name-part ordering, particle handling). If inlined into every compiled style, each style would be ~10-15KB instead of ~3-5KB. The shared helpers are the "standard library" that compiled styles call into — analogous to how compiled C calls libc rather than inlining `printf`.

**The 3-5KB per-style estimate assumes `@citestyle/core` is loaded separately.** The total cost for a site using one style is: `@citestyle/core` (~6-8KB) + one compiled style (~3-5KB) = **~9-13KB total** — still an order of magnitude smaller than citeproc-js's ~120KB+. Each additional style adds only its ~3-5KB delta.

The compiled style imports from `@citestyle/core`:

```javascript
// Inside compiled apa.js
import { formatNames, formatDate, titleCase, escapeHtml } from '@citestyle/core'

export function bibliography(item, ctx) {
  // Calls shared helpers with style-specific config baked in as arguments
  const authors = formatNames(item.author, {
    sortOrder: 'all', and: '&', etAlMin: 7, etAlUseFirst: 6, ...
  })
  // ...
}
```

The compiler decides what to inline (simple string operations, conditionals, affixes) vs. what to delegate to `@citestyle/core` (name formatting, date formatting, text-case transforms). The heuristic: if the logic depends on complex CSL attributes with multiple interaction modes, it's a shared helper. If it's a simple conditional or string concatenation, it's inlined.

### Layer 2: Citation Registry (`@citestyle/registry`)

The compiler produces pure formatting functions, but some CSL features require **cross-citation state**:

- **Year suffixes** — When two citations would render identically (same author, same year), append a/b suffixes (Smith, 2024a; Smith, 2024b)
- **Citation ordering** — Numeric styles need to track first-cite order
- **Bibliography sorting** — Using the compiled sort comparator
- **Basic grouping** — Collapsing multiple works by the same author in a single citation

This is a small runtime module (~5-8KB) — it doesn't parse XML, evaluate macros, or resolve locales. It just tracks state.

```javascript
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const registry = createRegistry(apa)

// Add items (from BibTeX import, API fetch, etc.)
registry.addItems(cslJsonItems)

// Format a citation cluster
const citation = registry.cite([
  { id: 'smith2024' },
  { id: 'jones2023', locator: '42', label: 'page' }
])
// → { html: '(Jones, 2023, p. 42; Smith, 2024)', ... }

// Get sorted bibliography
const bibliography = registry.getBibliography()
// → [{ html: '...', parts: {...}, links: {...} }, ...]
```

#### What the registry handles vs. what it skips

| Feature | Status | Rationale |
|---|---|---|
| Year-suffix assignment (2024a, 2024b) | Included | Common, visible, expected |
| Citation number tracking | Included | Required for numeric styles (IEEE, Vancouver) |
| Bibliography sort | Included | Uses compiled comparator — trivial |
| Subsequent author substitute | Included | Bibliography feature: replace repeated author with "———" |
| **ibid / subsequent position** | **Deferred** | Footnote-style — rare on web |
| **Near-note distance** | **Skipped** | Footnote-style — not applicable to web |
| **Full name disambiguation** | **Deferred** | Complex, diminishing returns for web (links resolve ambiguity) |
| **Cite collapsing** | **Deferred** | Numeric ranges (`[1-3]`) and author grouping (`(Smith, 2024a, 2024b)`) — nice to have, not critical |
| **CSL-M (legal/multilingual)** | **Skipped** | Out of scope entirely |

Deferred features can be added later as opt-in registry plugins without changing the core API.

### Layer 3: I/O Parsers (modular)

Independent modules for converting between formats:

| Module | Input | Output | Notes |
|---|---|---|---|
| `@citestyle/bibtex` | BibTeX string | CSL-JSON array | Scholar's parser, extracted and improved |
| `@citestyle/ris` | RIS string | CSL-JSON array | Common export format from databases |
| `@citestyle/doi` | DOI string | CSL-JSON item | Fetch metadata from CrossRef/DataCite API |
| `@citestyle/types` | — | TypeScript types | CSL-JSON schema as TS types |

Each is optional — import only what your project needs. The compiler itself only cares about CSL-JSON input; parsers are convenience.

### Layer 4: Citation Export (`@citestyle/export`)

The "copy citation" UX is ubiquitous on academic websites — Google Scholar, Semantic Scholar, publisher pages all offer it. This requires the reverse of parsing: converting formatted entries and CSL-JSON items into clipboard-ready or download-ready output in multiple formats.

```javascript
import { copyPlainText, copyRichText, exportBibtex, exportRis, exportCslJson } from '@citestyle/export'

// Copy formatted citation to clipboard (plain text)
await copyPlainText(entry)  // Uses entry.text

// Copy with formatting preserved (rich text)
await copyRichText(entry)   // Uses entry.html → clipboard as text/html

// Export for reference managers
const bibtex = exportBibtex(items)     // CSL-JSON → BibTeX string
const ris = exportRis(items)           // CSL-JSON → RIS string
const json = exportCslJson(items)      // CSL-JSON → formatted JSON string

// Download helpers
import { downloadFile } from '@citestyle/export'
downloadFile(bibtex, 'references.bib', 'application/x-bibtex')
downloadFile(ris, 'references.ris', 'application/x-research-info-systems')
```

**Architecture:**
- **Clipboard helpers** — `copyPlainText(entry)` and `copyRichText(entry)` wrap the Clipboard API, handling the `text/plain` and `text/html` MIME types. The rich-text copy preserves italic, bold, and link formatting when pasting into Word, Google Docs, etc.
- **Format serializers** — `exportBibtex()` is the reverse of `@citestyle/bibtex`'s parser: CSL-JSON → BibTeX string. `exportRis()` serializes to RIS format. `exportCslJson()` is trivial but included for completeness and consistent API.
- **Download helpers** — `downloadFile(content, filename, mimeType)` creates a Blob URL and triggers a download. Framework-agnostic (no React dependency).
- **Format registry** — `getFormats()` returns available export formats with labels, useful for building format picker UIs. Extensible — consumers can register custom formats.

**Why a separate package?** Export is optional — many sites only display bibliographies without offering copy/download. Keeping it separate (~2-3KB) means sites that don't need it pay nothing. It also has a browser-only dependency (Clipboard API, Blob/URL) that server-side packages shouldn't carry.

**Relationship to `@citestyle/bibtex`:** The bibtex package focuses on *parsing* (BibTeX → CSL-JSON). The export package handles *serialization* (CSL-JSON → BibTeX). These could share field-mapping tables, but the serialization direction and use case are different enough to justify separate packages. The bibtex package's `export.js` handles the low-level field mapping; `@citestyle/export` wraps it with clipboard and download UX.

## Package Structure

```
@citestyle/
├── compiler/           # CSL XML → JS module compiler (build tool, Node.js)
│   ├── src/
│   │   ├── parser/     # CSL XML → AST
│   │   ├── resolver/   # Macro inlining, locale merging
│   │   ├── codegen/    # AST → JS code generation
│   │   └── cli.js      # CLI entry: csl compile apa.csl -o apa.js
│   └── package.json
│
├── core/               # Shared runtime helpers (~6-8KB)
│   ├── src/
│   │   ├── names.js    # Name formatting (et-al, particles, ordering)
│   │   ├── dates.js    # Date formatting (localized, ranges, seasons)
│   │   ├── text.js     # Text-case transforms, escaping
│   │   ├── numbers.js  # Ordinal, roman, long-ordinal formatting
│   │   ├── pages.js    # Page range formatting algorithms
│   │   └── index.js
│   └── package.json
│
├── registry/           # Runtime citation state (~5-8KB)
│   ├── src/
│   │   ├── registry.js # Track citations, assign suffixes, sort
│   │   └── index.js
│   └── package.json
│
├── styles/             # Pre-compiled popular styles (convenience)
│   ├── apa.js          # ~3-5KB each
│   ├── mla.js
│   ├── chicago-author-date.js
│   ├── ieee.js
│   ├── vancouver.js
│   ├── harvard-cite-them-right.js
│   ├── ama.js
│   ├── turabian.js
│   ├── nature.js
│   ├── science.js
│   └── package.json
│
├── bibtex/             # BibTeX ↔ CSL-JSON
│   ├── src/
│   │   ├── parse.js
│   │   └── export.js
│   └── package.json
│
├── export/             # Multi-format citation export (~2-3KB)
│   ├── src/
│   │   ├── clipboard.js  # copyPlainText(), copyRichText()
│   │   ├── formats.js    # exportBibtex(), exportRis(), exportCslJson()
│   │   ├── download.js   # downloadFile() helper
│   │   └── index.js
│   └── package.json
│
├── types/              # TypeScript type definitions
│   ├── csl-json.d.ts   # CSL-JSON item schema
│   ├── style.d.ts      # Compiled style module interface
│   ├── registry.d.ts   # Registry API
│   └── package.json
│
└── locales/            # CSL locale data (used by compiler at build time)
    ├── locales-en-US.xml
    ├── locales-es-ES.xml
    ├── ...
    └── package.json
```

**Naming:** Published under the `@citestyle` scope on npm — a vendor-neutral name that signals a community tool for the CSL ecosystem, not a Uniweb-specific package. Repository at `github.com/uniweb/csl`. The compiler reads standard `.csl` files from the official CSL styles repository — full interoperability. The `core` + `registry` split keeps the runtime minimal: sites that only need bibliography formatting (no inline citations, no disambiguation) can skip the registry entirely and use compiled styles + core alone. The `export` package is optional — only needed for sites offering "copy citation" or download functionality.

## CSL Spec Coverage

### Full coverage (compile correctly)

These constructs compile to efficient JS and cover the vast majority of real-world styles:

| Construct | CSL element(s) | Compiler approach |
|---|---|---|
| **Text output** | `cs:text` (variable, macro, term, value) | Direct property access / function call / string constant |
| **Conditional rendering** | `cs:choose`, `cs:if`, `cs:else-if`, `cs:else` | `if`/`else if`/`else` chains |
| **Conditionals: type** | `type="article-journal"` | `item.type === '...'` |
| **Conditionals: variable** | `variable="DOI"` | `item.DOI != null && item.DOI !== ''` |
| **Conditionals: is-numeric** | `is-numeric="edition"` | Regex test for numeric content |
| **Conditionals: match** | `match="any"`, `"all"`, `"none"` | `||`, `&&`, `!()` operators |
| **Macros** | `cs:macro` | Inlined functions (or named if recursive/reused) |
| **Groups** | `cs:group` | Array collect → filter empties → join with delimiter |
| **Group suppression** | (implicit) | If all called variables empty, suppress entire group |
| **Names** | `cs:names`, `cs:name`, `cs:et-al` | Name-formatting functions with config baked in |
| **Name forms** | `form="short"`, `"long"`, `"count"` | Branching in name formatter |
| **Et-al abbreviation** | `et-al-min`, `et-al-use-first`, `et-al-use-last` | Baked into name formatter as constants |
| **Name ordering** | `name-as-sort-order` | Baked into name formatter |
| **Name parts** | `cs:name-part` (given/family) | Formatting applied to respective parts |
| **Substitute** | `cs:substitute` | Fallback chain: try each element, use first non-empty |
| **Dates** | `cs:date`, `cs:date-part` | Date-formatting function with locale parts inlined |
| **Date forms** | `form="numeric"`, `"text"` | Localized format baked in |
| **Date parts** | `name="year"`, `"month"`, `"day"` | Individual formatters composed |
| **Date ranges** | `range-delimiter` | Detect date ranges, format with custom delimiter |
| **Numbers** | `cs:number` | Number formatting with form (numeric, ordinal, roman, long-ordinal) |
| **Labels** | `cs:label` | Locale term lookup, pluralization |
| **Formatting** | `font-style`, `font-weight`, `font-variant`, `text-decoration` | HTML tags (`<i>`, `<b>`, `<span class="...">`) |
| **Affixes** | `prefix`, `suffix` | String concatenation |
| **Text-case** | `text-case="title"`, `"sentence"`, etc. | Case-transformation functions |
| **Quotes** | `quotes="true"` | Locale-aware quotation marks |
| **Strip-periods** | `strip-periods="true"` | String replace |
| **Delimiter** | `delimiter=", "` | Join logic |
| **Display** | `display="block"`, `"indent"`, etc. | CSS class mapping |
| **Sorting** | `cs:sort`, `cs:key` | Compiled comparator function |
| **Locale terms** | `cs:term` (with form, plural) | Inlined string constants |
| **Locale fallback** | Style → locale file → en-US | Resolved at compile time |
| **Inheritable name options** | Global → citation/bibliography → names | Resolved at compile time (flattened) |
| **Page ranges** | `page-range-format` | Chicago/expanded/minimal algorithms |
| **Year suffixes** | `disambiguate-add-year-suffix` | Registry feature (runtime) |
| **Subsequent author substitute** | `subsequent-author-substitute` | Registry feature (bibliography rendering) |
| **Dependent styles** | `cs:link rel="independent-parent"` | Resolve parent at compile time, compile the parent |

### Deferred (not in v1)

| Feature | Why deferred | Path to add later |
|---|---|---|
| **ibid / subsequent / near-note** | Footnote-centric — not applicable to most web content | Registry plugin for note styles |
| **Full name disambiguation** | Complex multi-pass algorithm, low value for web (links resolve ambiguity) | Registry plugin with `disambiguate-add-givenname` |
| **Cite collapsing / grouping** | Numeric range compression (`[1-3]`), author grouping | Registry extension |
| **is-uncertain-date** | Rare in practice | Conditional branch in compiler |
| **CSL-M extensions** | Legal/multilingual — different spec entirely | Separate compiler flag |

### Explicitly out of scope

- **CSL-M (Multilingual/Legal)** — Different spec with different goals
- **Word-processor integration** — citeproc-js does this well, no need to compete
- **Real-time collaborative editing** — Zotero/Mendeley territory
- **100% citeproc-js test compatibility** — We target web rendering, not print-submission parity

## Web-Native Enhancements

These are features no existing CSL processor provides, because they all target word processors:

### 1. Semantic HTML output

```html
<!-- Instead of a flat string: -->
<div class="csl-entry">
  <span class="csl-author">Smith, J. A., &amp; Jones, B. C.</span>
  <span class="csl-year"> (2024)</span>.
  <span class="csl-title"> A study of citation formatting</span>.
  <i class="csl-container">Journal of Examples</i>,
  <span class="csl-locator">12(3), 45–67</span>.
  <a class="csl-link csl-doi" href="https://doi.org/10.1234/example">
    https://doi.org/10.1234/example
  </a>
</div>
```

Style these with your design system. No string parsing needed.

### 2. Automatic linking

DOIs, URLs, ISBNs, and PMIDs become clickable links automatically. citeproc-js outputs `https://doi.org/10.1234/example` as plain text — on the web, that's a missed opportunity.

### 3. Structured parts for custom layouts

```jsx
// Render as a card instead of a citation string
const { parts, links } = compiled.bibliography(item, ctx)

<article class="pub-card">
  <h3>{parts.title}</h3>
  <p class="authors">{parts.authors.map(a => a.formatted).join(', ')}</p>
  <p class="venue">{parts.container} ({parts.year})</p>
  {links.doi && <a href={links.doi}>DOI</a>}
  {links.pdf && <a href={links.pdf}>PDF</a>}
</article>
```

### 4. CSS class hooks for theming

Every formatted part gets a CSS class. Foundation themes can style citations to match their design system — dark mode, custom fonts, accent colors — without touching the citation logic.

### 5. Accessibility

Semantic HTML means screen readers understand the structure. The `text` output provides clean alt-text. ARIA attributes can be added to the HTML template.

## Web Display Styles: Beyond Print Formatting

### The problem with print styles on the web

Every existing citation style — APA, MLA, Chicago, IEEE, Vancouver, all 10,000+ of them — was designed for print. This has consequences:

1. **Everything is crammed into a flat string** because print has one channel. A DOI URL takes up half the line as plain text because there's no alternative. On the web, that's a button.

2. **Redundant information** that could be a link is spelled out. Publisher, location, page numbers — in print you need to see them all at once. On the web, they can be layers: visible on hover, expandable on click.

3. **No representation for modern scholarship artifacts.** A 2024 paper might have a GitHub repo, a Zenodo dataset, slides from a conference talk, a YouTube recording, and an arXiv preprint. None of these fit in APA format because APA was designed before any of them existed.

4. **Uniform density regardless of context.** A bibliography at the end of a blog post and a professor's 200-item publication page use the same string format. But the blog needs a compact list, while the publication page needs filterable cards with abstracts.

The compiled CSL styles solve the formatting correctness problem. Web display styles solve the **presentation** problem — how citations actually appear on screen.

### Two-layer approach

```
Layer 1: CSL Style (compiled)    → WHAT to show (fields, order, punctuation)
Layer 2: Web Display Style       → HOW to show it (layout, interaction, density)
```

CSL controls the formatting logic: which fields appear, in what order, with what punctuation. This ensures academic correctness — an APA reference puts the year after the author, MLA puts it at the end, etc.

Web display styles control the presentation: card vs. inline vs. compact, which links get buttons vs. text, what expands on click, how the bibliography is sorted and filtered. These are **rendering modes**, not formatting rules.

The `parts` + `links` output from compiled CSL styles is the bridge between the two layers. A web display style consumes structured data and renders it in a web-native way, while the compiled CSL style guarantees the underlying formatting is academically correct.

### Proposed web display styles

#### 1. `compact` — Enhanced bibliography list

The closest to traditional print styles, but with web enhancements. Good for reference lists at the end of articles or blog posts.

```
Smith, J. A., & Jones, B. C. (2024). A study of citation
formatting. Journal of Examples, 12(3), 45–67.  [DOI] [PDF]
```

- Formatted text follows the CSL style (APA, MLA, etc.)
- DOI/URL become small linked badges instead of raw URLs
- Asset links (PDF, code, data) appear as icon buttons at the end
- Hover on author names → tooltip with affiliation/ORCID
- Hanging indent, accessible markup

#### 2. `card` — Publication cards

Structured cards for publication profile pages, research group sites, CVs. Not a citation string — a designed component.

```
┌──────────────────────────────────────────────────┐
│  A Study of Citation Formatting                   │
│  Smith, J. A. · Jones, B. C.        2024         │
│  Journal of Examples, 12(3)                       │
│                                                    │
│  [DOI]  [PDF]  [Code]  [Slides]  [BibTeX]        │
│                                                    │
│  ▸ Abstract                                       │
└──────────────────────────────────────────────────┘
```

- Title as heading, authors as chips (clickable to profile page)
- Venue + year on a separate line — no APA-style parenthetical gymnastics
- Asset links as buttons with icons
- Expandable abstract (collapsed by default)
- Optional: keywords as tags, open-access badge, award badge
- The CSL style is still used for the copy-to-clipboard text format

#### 3. `minimal` — Dense list

Maximum density for CVs, tenure dossiers, grant applications. Shows only what's essential, everything else is one click away.

```
Smith & Jones (2024). A study of citation formatting.
  J. Examples 12(3). ↗
```

- Abbreviated journal names (CSL `form="short"` when available)
- Single external link icon (↗) to the DOI or primary URL
- No asset links visible (accessible via click/expand)
- Optimized for printing (degrades gracefully to plain text)

#### 4. `rich` — Full detail

Comprehensive display for research portals, lab websites, or self-hosted academic profiles. Everything visible.

```
┌──────────────────────────────────────────────────┐
│  🔓 Open Access                         2024     │
│                                                    │
│  A Study of Citation Formatting                   │
│  J. A. Smith¹ · B. C. Jones²                     │
│  ¹ University of Examples · ² Institute of Tests  │
│                                                    │
│  Journal of Examples, Vol. 12, Issue 3, pp. 45–67│
│                                                    │
│  Abstract: Lorem ipsum dolor sit amet,            │
│  consectetur adipiscing elit. Sed do eiusmod...   │
│  [Show more]                                      │
│                                                    │
│  Keywords: citations, formatting, web             │
│                                                    │
│  [DOI] [PDF] [Code] [Dataset] [Slides] [Video]   │
│                                                    │
│  Cite as: Smith, J. A., & Jones, B. C. (2024)... │
│  [Copy APA] [Copy BibTeX] [Copy RIS]             │
└──────────────────────────────────────────────────┘
```

- All metadata visible (abstract, keywords, affiliations)
- Multiple citation format export (APA, BibTeX, RIS)
- All available asset links with icons
- Open-access status badge
- Author affiliations (from extended metadata)

### Extended metadata for web artifacts

CSL-JSON was designed for print-era scholarship. Modern papers have associated artifacts that CSL can't represent. We define an **extended metadata** layer that sits alongside standard CSL-JSON fields:

```typescript
interface WebScholarMetadata {
  // Standard CSL-JSON fields (DOI, URL, etc.) remain as-is

  // Extended: artifact links
  pdf_url?: string          // Direct link to PDF
  code_url?: string         // GitHub/GitLab repository
  data_url?: string         // Dataset (Zenodo, Figshare, Dryad)
  slides_url?: string       // Presentation slides
  video_url?: string        // Recorded talk (YouTube, Vimeo)
  preprint_url?: string     // arXiv, SSRN, bioRxiv
  demo_url?: string         // Live demo or interactive visualization
  poster_url?: string       // Conference poster

  // Extended: scholarly context
  open_access?: boolean | 'gold' | 'green' | 'bronze'
  awards?: string[]         // "Best Paper", "Honorable Mention"
  abstract?: string         // Already in CSL-JSON, but rarely used by print styles
  keywords?: string[]       // Already in CSL-JSON
  affiliations?: Record<string, string>  // author-id → affiliation

  // Extended: metrics (optional, consumer-provided)
  citation_count?: number
  altmetric_score?: number
}
```

This metadata lives in a `custom` or `extended` field on CSL-JSON items. The compiled CSL style ignores it (it only uses standard CSL fields for formatting). Web display styles consume it for rendering asset links, badges, and expandable sections.

**Where does extended metadata come from?** In Uniweb, it could come from the content layer — a BibTeX file with extra fields, a YAML file alongside the bibliography, or API responses from CrossRef/OpenAlex/Semantic Scholar. The I/O parsers (`@citestyle/bibtex`, etc.) would preserve non-standard fields in the `extended` property rather than discarding them.

### Why these aren't CSL files

CSL is a formatting spec — it defines field order, punctuation, text-case, abbreviation rules. It's the right tool for ensuring "APA 7th edition" looks correct. Trying to extend CSL to handle card layouts, expandable sections, and icon buttons would be forcing a print-era spec into a different medium.

Web display styles are **rendering templates** — they consume the structured output (`parts`, `links`, extended metadata) and produce web UI. They're defined as:

- **Framework-agnostic rendering functions** in `@citestyle/styles` (return HTML strings, like compiled CSL styles)
- **React components** in `@uniweb/scholar` (consume `parts` and render JSX)
- **CSS classes** that can be themed (each display style has a defined class structure)

A site can mix and match: use compiled APA for the formatting logic, `card` for the publication page layout, and `compact` for the blog footer bibliography. The CSL style and the web display style are independent axes of choice.

### Priority web display styles for v1

| Style | Primary use case | Complexity |
|---|---|---|
| `compact` | Article bibliographies, blog references | Low — enhanced CSL HTML output |
| `card` | Publication pages, research profiles | Medium — structured layout, asset buttons |
| `minimal` | CVs, dense publication lists | Low — abbreviated CSL output |
| `rich` | Lab websites, academic portals | High — full metadata, expandable sections |

`compact` and `card` cover the vast majority of web use cases and should ship with v1. `minimal` is trivial (a CSS variant of compact). `rich` can follow in post-v1 when extended metadata support is mature.

## Integration with @uniweb/scholar

Scholar's current architecture already has the right seams. The integration is surgical:

### Current flow

```
CitationProvider({ references, style: 'apa' })
  → parseBibtex(references) or direct array
  → formatReference(pub, { style }) → formatters['apa'](pub) → string
  → Bibliography renders formatted strings
  → Citation renders inline "(Smith, 2024)"
```

### With compiled CSL

```
CitationProvider({ references, style: compiledApa })
  → parseBibtex(references) or direct array
  → registry.addItems(items)
  → registry.getBibliography() → structured entries
  → Bibliography renders HTML with CSS classes
  → registry.cite([...]) → structured inline citation
```

### Migration path

**Phase 1: Drop-in replacement** — Compiled styles produce strings via `.text`, existing `formatReference()` works unchanged. Scholar gains CSL compliance with no component changes.

**Phase 2: Structured output** — Bibliography and Citation components switch from `dangerouslySetInnerHTML` string to rendering structured `.html` output. CSS class hooks available.

**Phase 3: Parts API** — New components (PublicationCard, AuthorProfile) consume `.parts` for non-citation layouts.

### Scholar's role evolves

| Current | With CSL compiler |
|---|---|
| Hardcoded APA/MLA/Chicago/IEEE formatters | Import compiled styles from `@citestyle/styles` |
| Custom BibTeX parser | Extract to `@citestyle/bibtex` (or keep both) |
| CitationProvider + Citation + Bibliography | Keep — these are the React integration layer |
| Math (KaTeX) | Unchanged — orthogonal concern |
| UI components (CiteButton, etc.) | Keep — enhanced with structured parts |

Scholar becomes **the React integration layer** on top of `@citestyle/*` packages — not a formatting engine itself.

## Implementation Status

### v0.1 — Core pipeline ✅

Parser + codegen + core helpers + APA compilation. 69 tests.

**What was built:**
- CSL XML parser (`@xmldom/xmldom` DOM → CSL AST)
- Code generator (AST → JavaScript module)
- Core helpers: `formatNames`, `formatDate`, `titleCase`, `sentenceCase`, `capitalize`, `ordinal`, `roman`, `pageRange`, `escapeHtml`
- Locale resolution with en-US fallback
- CLI: `csl compile <file>`
- APA 7th compiles and produces correct output

### v0.2 — Multi-style + structured output ✅

5 styles + HTML output + CSL test suite runner. 113 tests.

**What was built:**
- **5 real styles compile correctly**: APA 7th, MLA 9th, Chicago Author-Date 18th, IEEE, Vancouver (Elsevier)
- **Structured output**: `{ text, html }` — text is plain, html has semantic CSS classes + auto-linked DOIs/URLs
- **Formatting token system**: PUA characters U+E000-E007 for italic/bold/small-caps/underline, converted at final output
- **CSL test suite runner**: compiles embedded CSL from fixtures, compares against reference output. 16 fixtures passing.
- **Locator support**: `<text variable="locator"/>` and `<label variable="locator"/>` with dynamic term lookup + plural detection
- **Section-level name options**: Runtime `_nameConfig()` merges global → section → element options correctly
- **`page-first` derived variable**: Extracts first page from ranges
- **Title case improvements**: Preserves abbreviations (all-caps words in mixed-case text, internal capitals like "OpenAI")

**Key design discoveries:**

1. **Name options must resolve at runtime, not compile time.** Macros are shared between citation and bibliography, but each section can have different et-al settings. The original design baked name config at compile time; v0.2 refactored to runtime merging via `_nameConfig(ctx, elementOpts)`.

2. **Empty-string attributes are meaningful.** `initialize-with=""` means "initialize with nothing" (Vancouver: "Smith JA"), not "don't initialize". The parser must use `hasAttribute()` checks, and option merging must use `??` (not `||`) to preserve falsy values.

3. **Formatting tokens simplify the pipeline.** Instead of threading HTML/text output modes through every rendering function, embed neutral PUA markers and convert at the final stage. This keeps the rendering pipeline clean and makes punctuation normalization PUA-aware.

4. **Label variable="locator" is special.** Unlike other labels where the term name is derived from the variable name (page → "page", volume → "volume"), the locator label term comes from the cite's label property (page, chapter, verse, etc.) — a runtime value, not a compile-time constant.

### v0.3 — Registry + semantic HTML + compiler gaps ✅

Citation registry, semantic HTML, and compiler gap fixes. 147 tests.

**What was built:**
- **Citation registry** (`@citestyle/registry`): `createRegistry(style)` → `addItems()`, `getItem()`, `cite()`, `getBibliography()`. Citation-number assignment, bibliography sorting via compiled comparator, subsequent-author-substitute.
- **Semantic HTML**: Every CSL variable wrapped in `<span class="csl-{variable}">` via PUA token protocol (U+E020-E022). Enables CSS theming of individual fields.
- **Name-part text-case**: `<name-part name="family" text-case="uppercase"/>` compiles correctly with text-case and font formatting on individual name parts.
- **delimiter-precedes-et-al**: Full support for contextual/always/never/after-inverted-name modes.
- **et-al-use-last fix**: "A, B, … Z" ellipsis pattern no longer adds "and" connector before last name.
- **Citation non-mutation**: `cite()` uses spread instead of mutating original items when merging locator data.
- **17 CSL test suite fixtures** passing (added namepart_TextCaseUppercase).

**Key design discoveries:**

1. **Semantic HTML via PUA tokens, not premature HTML.** The codegen wraps each variable's output in `\uE020className\uE021content\uE022` tokens. These pass through all text processing (punctuation normalization, group suppression, delimiter joining) unmodified, then `toHtml()` converts them to `<span>` tags at the final stage. This is the same strategy as the formatting tokens (U+E000-E007) — neutral markers that don't interfere with text operations.

2. **toHtml() processing order is critical.** Auto-linking DOIs and URLs must happen BEFORE converting semantic tokens to HTML, because the PUA chars naturally act as URL boundaries. If converted first, the generated `<span>` tags create false matches for URL regex lookahead/lookbehind.

3. **Punctuation normalization must know about all PUA ranges.** The double-period elimination regex (`._F._F`) uses a "filler" pattern to skip PUA chars between periods. When semantic tokens (U+E020-E022) were added, the filler pattern had to be extended from `[\uE000-\uE007]*` to `[\uE000-\uE007\uE020-\uE022]*` to prevent double periods like `Smith, J. A.\uE022. (2024)`.

4. **Registry subsequent-author-substitute is a post-processing step.** The bibliography is formatted normally, then consecutive entries with the same author key get their author text replaced. HTML replacement uses the semantic `<span class="csl-author">` tag for precise targeting.

### v0.4 — More styles + year-suffix + test expansion (complete)

**Completed:**
- 5 more styles (Harvard, AMA, Nature, Science, ACS) — replaced Turabian (dependent style → just Chicago with a different name)
- Year-suffix assignment in registry — detects author+year collisions, sets `item['year-suffix']` = a/b/c
- CSL test fixtures expanded from 17 → 45 (names, groups, conditions, dates, numbers, labels, affixes, decorations, macros, sort)
- `match="none"` condition bug fix — multi-value tests were double-negating
- `second-field-align="flush"` — proper citation-number spacing in numeric styles
- `vertical-align="sup"` — superscript citations in HTML for Nature, ACS, etc.
- Bare DOI auto-linking (`doi:10.xxx`) in `toHtml()` for IEEE, AMA-style formatting
- Structured output audit: all 10 styles verified for CSS classes, parts, links, DOI linking

**Key design discoveries:**
5. **Condition match flattening.** CSL match modes (any/all/none) must be applied once across ALL individual checks (from all test attributes), not per-attribute then re-applied in the outer join. The old architecture applied match in `wrapMultiCheck` and again in the outer loop, causing double-negation for `match="none"`.

6. **second-field-align needs PUA awareness.** When adding the space between citation-number and entry body, must check if the first field already ends with whitespace by looking through trailing PUA close tokens (`/\s[\uE000-\uE007\uE020-\uE022]*$/`).

### v0.5 — Nocase spans + more disambiguation (next)

**Goals:**
- Nocase span support for text-case transforms
- Full name disambiguation (add-names, add-givenname)
- Cite collapsing for numeric styles
- 5 more styles (ABNT, Springer, Elsevier, APA-CV, Chicago Notes)

## Implementation Plan

### Phase 1: CSL Parser + Core Codegen ✅

**Completed.** Parser, AST, macro resolution, core codegen, APA compilation.

### Phase 2: Names + Dates + Locale + @citestyle/core ✅

**Completed.** Full name formatting engine, date formatting, locale resolution, number formatting. All core helpers extracted to `@citestyle/core`. Five styles compile correctly.

**Lessons learned:**
- Real styles exercise many more edge cases than test-driven development alone. Chicago Author-Date alone exposed section-level name option cascading, complex macro chains, and conditional nesting.
- IEEE and Vancouver (numeric styles) require `citation-number` variable support and different name formatting (no-sort, initials-only).
- The `initialize-with=""` (empty string) semantics were a subtle but critical fix — Vancouver names went from "Smith J A" to "Smith JA".

### Phase 3: Structured Output + Registry ✅

**Completed.** Full structured output (`{ text, html, parts, links }`). Semantic HTML with per-variable CSS classes. Citation registry with bibliography sorting, citation numbering, and subsequent-author-substitute.

- **Semantic HTML tokens** (U+E020-E022): codegen wraps each variable in PUA markers, converted to `<span class="csl-{variable}">` by `toHtml()`
- **Registry API**: `createRegistry(style)` → `addItems()`, `getItem()`, `cite()`, `getBibliography()`
- **parts/links**: Already working from v0.2 codegen; parts extracts raw field values, links extracts DOI/URL/PDF

### Phase 4: Test Suite + Top 10 Styles ✅

**Completed.** 10 styles compile and produce correct output. 45 CSL fixtures passing. 211 tests total.

- **Test harness:** Runner handles variant section delimiters, CITATION-ITEMS with locators, HTML stripping, numeric entity decoding (`&#8211;` → `–`), quote normalization. Auto-skips deferred features.
- **45 fixtures:** names (particles, initials, hyphenated, form, et-al, substitute, literal, 3-author), groups (suppression, delimiter, nesting), conditions (type, variable, is-numeric, match all/any/none), dates (month, accessed, range, season, short form), numbers (ordinal, roman), labels (short, empty, plural), affixes (prefix/suffix), decorations (italic, bold, quotes), text-case, macros, strip-periods, static values, sort keys.
- **10 styles:** APA, MLA, Chicago Author-Date, IEEE, Vancouver, Harvard, AMA, Nature, Science, ACS.

### Phase 5: Scholar Integration + CLI

**Not started.** Depends on registry completion.

### Phase 6: Documentation + Release

**Not started.**

## Key Design Decisions

### Why compile to JS, not WASM?

WASM (like citeproc-rs) adds a binary blob that can't be inspected, debugged, or tree-shaken. Compiled JS is:
- **Debuggable** — Stack traces point to readable code
- **Tree-shakable** — Bundlers eliminate unused branches
- **Inspectable** — Developers can read what the compiled style does
- **Zero-overhead** — No WASM runtime initialization cost
- **Portable** — Works in Node.js, Deno, Bun, browsers, edge runtimes

### Why inline locale terms?

citeproc-js loads locale XML at runtime (~20KB per locale). The compiler resolves locale terms at build time and inlines them as string constants. A compiled style for `en-US` has no runtime locale loading — the terms are literally in the code:

```javascript
// Inlined by compiler from locales-en-US.xml
const terms = {
  'et-al': 'et al.',
  'and': 'and',
  'month-01': 'January',
  // ...
}
```

Multi-locale support: compile the same style for multiple locales, import the one you need.

### Why structured output instead of just strings?

Strings are fine for word processors (the original CSL target). On the web, structured output enables:
- Styling parts independently with CSS
- Rendering citations as cards, lists, or tables — not just formatted text
- Making links clickable without post-processing regex
- Providing accessible HTML to screen readers
- Extracting parts for search indexes, metadata, or APIs

The `.text` property always provides a plain-text fallback for compatibility.

### Null safety in compiled output

CSL-JSON items frequently have missing fields (no DOI, no volume, no editor). The compiled code must handle this gracefully. The compiler emits null-checks around every variable access and relies on group suppression semantics: a `cs:group` that references only empty variables produces no output (no dangling delimiters, no orphaned punctuation). This mirrors the CSL spec's behavior and is one of the main reasons the codegen can't just be a simple template — the suppression logic is contextual.

### Source maps

The compiler can optionally emit source maps (`--sourcemap`) that map the generated JS back to the original `.csl` XML. This helps style authors debug formatting issues: a breakpoint in the compiled `bibliography()` function shows which CSL element produced that code. Not essential for v1, but a valuable developer experience improvement.

### HTML escaping and XSS safety

The structured HTML output interpolates user-provided data (titles, author names, publisher names) directly into HTML. **Every variable interpolation must be HTML-escaped** (`<` → `&lt;`, `&` → `&amp;`, etc.) to prevent XSS. The `escapeHtml()` function in `@citestyle/core` handles this, and the compiler emits escape calls around all variable accesses in HTML-output mode. The `text` output does not need escaping (it's plain text). The `parts` object contains raw unescaped values (consumers handle their own escaping via their framework — React auto-escapes JSX, etc.).

### The `disambiguate` conditional: cross-layer protocol

CSL's `<if disambiguate="true">` renders content only when disambiguation is active. This creates a dependency between the compiled style and the registry:

1. The registry detects ambiguous citations (same rendered author-year)
2. The registry re-calls the compiled style's `bibliography()` with `ctx.disambiguate = true`
3. The compiled style's conditional branch activates, adding disambiguating content

This means the `FormatContext` object (`ctx`) is the communication protocol between registry and compiled style. The compiler emits `if (ctx.disambiguate)` branches; the registry sets the flag. This protocol must be documented as part of the compiled style interface.

### Why start with a subset of CSL features?

The full CSL spec includes features designed for footnote-heavy styles (ibid, near-note distance) and journal-submission requirements (full name disambiguation, cite collapsing). These add significant complexity and have low value for web rendering:

- **ibid** — Footnote concept, not used in author-date web content
- **Near-note distance** — Only meaningful in footnote styles
- **Full name disambiguation** — On the web, citations link to the bibliography entry; visual disambiguation is less critical
- **Cite collapsing** — `[1-3]` instead of `[1, 2, 3]` — nice but not essential

Starting with the 80% that serves 99% of web use cases gets a useful tool into developers' hands sooner. Deferred features are architecturally possible (the registry is extensible) and can be added driven by real demand.

## Success Criteria

### v1.0 release

- [x] 5 popular styles compile correctly (APA, MLA, Chicago, IEEE, Vancouver)
- [ ] 10+ popular styles compile correctly (+ Harvard, AMA, Turabian, Nature, Science)
- [x] HTML + text structured output for all compiled styles
- [ ] Full structured output (HTML + parts + links + text) for all compiled styles
- [x] CSL test suite runner with 16 passing fixtures
- [ ] CSL test suite: 80%+ pass rate on supported-feature tests (target: 50+ fixtures)
- [ ] Bundle size: <8KB `@citestyle/core`, <5KB per compiled style, <8KB registry (~20KB total for one style)
- [ ] Scholar integration working (backward-compatible API)
- [x] CLI: `csl compile <file>` (basic)
- [ ] CLI: `csl compile <style>` with locale and format options
- [ ] TypeScript types for all public APIs
- [ ] Published to npm under `@citestyle/*` scope
- [ ] Documentation with examples and migration guide
- [ ] Web display styles: `compact` and `card` rendering modes
- [ ] `@citestyle/export`: clipboard copy (plain text + rich text), BibTeX/RIS/CSL-JSON export, file download

### Post-v1

- [ ] 20+ compiled styles in `@citestyle/styles`
- [ ] Web display styles: `minimal` and `rich` rendering modes
- [ ] Extended metadata support (code_url, data_url, slides_url, etc.)
- [ ] Vite plugin for `.csl` imports
- [ ] Registry plugins: ibid, full disambiguation, cite collapsing
- [ ] RIS and DOI parsers in `@citestyle/ris`, `@citestyle/doi`
- [ ] CrossRef/OpenAlex metadata fetching (auto-populate extended metadata)
- [ ] Search/filter utilities — fuzzy search over bibliography items by author, title, year, keywords (likely a registry extension or standalone utility)
- [ ] Sort/group utilities — group bibliography by year, type, or first author; sort by any field (registry already sorts for bibliography, but consumer-facing grouping is different)
- [ ] Online playground (compile + preview in browser)
- [ ] Community contributions: new styles, locale fixes, edge-case reports

## Open Questions

1. ~~**Package scope naming**~~ — **Resolved.** Published under `@citestyle/*` on npm. Repository at `github.com/uniweb/csl`. The hybrid approach: engine packages (`compiler`, `core`, `registry`, `styles`) under `@citestyle/*`; `@uniweb/scholar` remains the React/Uniweb integration layer that imports from them.

2. **Locale bundling strategy** — Inlining locale terms produces the smallest, fastest output but means a separate compiled module per locale. For multilingual sites that switch locales at runtime (e.g., a bilingual CV), options include: (a) compile separate modules per locale, lazy-load the active one; (b) compile a multi-locale variant that accepts a locale parameter and carries a small lookup table (~1-2KB per additional locale); (c) hybrid — inline the primary locale, fetch secondary locale terms at runtime from `@citestyle/locales`. The CLI could support `--locale en-US,fr-FR` to produce multi-locale bundles. Decision should be informed by real usage patterns.

3. **Custom CSL styles** — Some institutions have custom `.csl` files. The compiler handles these automatically (that's the point), but we should document the workflow: download `.csl` → compile → import.

4. **Citation.js compatibility** — Citation.js uses CSL-JSON as its intermediate format. Our `@citestyle/bibtex` parser should produce the same CSL-JSON shape so items can flow between tools.

5. **Collaboration with CSL project** — The CSL project (citationstyles.org) maintains the spec, styles repo, and locale files. Engaging them early — contributing compiled styles back, getting feedback on the structured output spec — would benefit both projects.

## Comparison with Alternatives

| | citeproc-js | citeproc-rs (WASM) | Citation.js | Scholar (current) | **@citestyle/compiler** |
|---|---|---|---|---|---|
| **Architecture** | Runtime XML interpreter | Runtime WASM interpreter | Wrapper around citeproc-js | Hardcoded formatters | Build-time compiler |
| **Bundle size** | ~120KB + locale XML | ~200KB+ WASM | ~50KB + deps | ~15KB (formatters only) | **~9-13KB first style (core + style), ~3-5KB each additional** |
| **Styles supported** | 10,000+ | 10,000+ (incomplete) | 10,000+ | 4 | **Any .csl file** |
| **Output format** | Flat string | Flat string | Flat string | Flat string | **Structured HTML + parts** |
| **Web-native linking** | No | No | No | Manual | **Automatic** |
| **Tree-shakable** | No | No | Partially | Yes | **Yes** |
| **Debugging** | Hard (monolithic) | Hard (WASM) | Medium | Easy | **Easy (readable JS)** |
| **Build-time cost** | None (all runtime) | None (all runtime) | None (all runtime) | None | **Compilation step** |
| **ibid/near-note** | Full | Partial | Full | No | **Deferred (plugin)** |
| **Disambiguation** | Full | Partial | Full | No | **Year-suffix only (v1)** |
| **Web display modes** | None | None | None | None | **compact, card, minimal, rich** |
| **Extended metadata** | No | No | No | No | **code, data, slides, video, preprint links** |

## Prior Art and Inspiration

- **Tailwind CSS** — The closest analogy. Tailwind compiles a declarative utility vocabulary into optimized CSS at build time — you import only what you use, the rest is eliminated. We do the same: compile a declarative style vocabulary (CSL XML) into optimized JS, import only the styles you need.
- **GraphQL code generators** — Schema → typed resolvers/queries. Declarative spec → efficient, typed runtime code with no interpretation overhead.
- **Shiki** — Proved that using the *standard grammar format* (TextMate) with a better engine beats hand-writing grammars (Prism). We take the same lesson: use the *standard style format* (CSL) instead of hand-writing formatters. But where Shiki still interprets at runtime (via WASM Oniguruma), we go further — the style compiles away entirely.
- **SWC/esbuild** — Moved JavaScript transformation from runtime interpretation (Babel) to compiled, optimized tooling. The broader pattern of "make it a build step" is well-established and consistently delivers order-of-magnitude improvements.

## Appendix: CSL-JSON Item Shape

The CSL-JSON format is the interchange standard. All CSL processors consume it. Our compiler expects it too.

```typescript
interface CslItem {
  id: string
  type: CslItemType  // 'article-journal', 'book', 'chapter', etc.

  // Names (each is an array of CslName)
  author?: CslName[]
  editor?: CslName[]
  translator?: CslName[]
  'container-author'?: CslName[]
  'collection-editor'?: CslName[]

  // Titles
  title?: string
  'title-short'?: string
  'container-title'?: string
  'collection-title'?: string

  // Dates
  issued?: CslDate
  accessed?: CslDate
  'original-date'?: CslDate

  // Numbers
  volume?: string | number
  issue?: string | number
  page?: string
  edition?: string | number
  'chapter-number'?: string | number

  // Identifiers
  DOI?: string
  URL?: string
  ISBN?: string
  ISSN?: string
  PMID?: string

  // Other
  publisher?: string
  'publisher-place'?: string
  abstract?: string
  language?: string
  genre?: string
  // ... (full list in CSL spec)
}

interface CslName {
  family?: string
  given?: string
  suffix?: string
  'non-dropping-particle'?: string
  'dropping-particle'?: string
  literal?: string  // For institutional names
}

interface CslDate {
  'date-parts'?: number[][]  // [[2024, 3, 15]] or [[2024, 3], [2024, 6]] for ranges
  literal?: string           // Unparsed date string
  raw?: string               // Raw date string
  season?: number
  circa?: boolean
}
```

## Appendix: Example Compilation

### Input: Simplified APA `cs:bibliography` `cs:layout`

```xml
<layout suffix="." delimiter=". ">
  <group>
    <names variable="author">
      <name name-as-sort-order="all" and="symbol"
            delimiter=", " delimiter-precedes-last="always"
            initialize-with=". " />
      <et-al font-style="italic"/>
      <substitute>
        <names variable="editor"/>
        <text variable="title"/>
      </substitute>
    </names>
    <date variable="issued" prefix=" (" suffix=")">
      <date-part name="year"/>
    </date>
  </group>
  <text variable="title" prefix=" " font-style="italic"/>
</layout>
```

### Compiled output (actual pattern)

```javascript
// Generated by @citestyle/compiler from apa.csl
import { formatNames, formatDate, escapeHtml, stripFormatting, toHtml,
         titleCase, sentenceCase, capitalize, ordinal, roman, pageRange } from '@citestyle/core'

const T = { "et-al": "et al.", "and": "and", "page": { single: "page", multiple: "pages" }, /* ... */ }
const MONTHS = { /* locale month names */ }
const NAME_OPTS = { etAlMin: 20, etAlUseFirst: 19, and: 'symbol', /* ... */ }

// Runtime name config merging: global → section → element
function _nameConfig(ctx, el) {
  const c = Object.assign({}, NAME_OPTS, ctx._secOpts || {}, el)
  if (c.and === 'text') c.andTerm = T['and'] || 'and'
  else if (c.and === 'symbol') c.andTerm = '&'
  if (!c.etAlTerm) c.etAlTerm = T['et-al'] || 'et al.'
  return c
}

// Shared macros — called by both citation() and bibliography()
function macro_author(item, ctx) {
  // Names with substitute chain: author → editor → title
  let _v1 = item.author?.length ? formatNames(item.author, _nameConfig(ctx, {})) : ''
  if (!_v1) _v1 = item.editor?.length ? formatNames(item.editor, _nameConfig(ctx, {})) : ''
  if (!_v1) _v1 = item.title || ''
  return _v1
}

const BIB_NAME_OPTS = { etAlMin: 20, etAlUseFirst: 19, /* bibliography-specific */ }

export function bibliography(item, ctx = {}) {
  ctx = { ...ctx, _secOpts: BIB_NAME_OPTS }
  // ... render layout children, each as a variable ...
  // Formatting uses PUA tokens: '\uE000' + text + '\uE001' for italic
  const _v3 = item.title ? '\uE000' + item.title + '\uE001' : ''
  // ... assemble parts with group suppression ...
  const _raw = /* assembled string with PUA tokens */
  // Final stage: normalize punctuation, then split into text/html
  const _norm = _normalizePunctuation(_raw)
  const text = stripFormatting(_norm)     // PUA tokens stripped → plain text
  const html = '<div class="csl-entry">' + toHtml(_norm) + '</div>'  // PUA → HTML tags + auto-links
  return { text, html }
}
```

Key patterns in actual compiled output:
- **PUA formatting tokens** embedded in strings during rendering, converted at final output
- **`_nameConfig(ctx, el)`** for runtime name option resolution (macros shared between sections)
- **Group suppression**: arrays collect parts, filter empties, join — no output if all variables empty
- **Null-safe variable access**: every `item.prop` guarded with empty checks
- **Punctuation normalization**: PUA-aware, collapses duplicate periods across formatting boundaries
