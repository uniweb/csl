# CLAUDE.md

## About Citestyle

Citestyle is a **build-time CSL compiler** that transforms standard Citation Style Language (`.csl`) XML files into lightweight JavaScript modules with structured, web-native output. Published on npm under the `@citestyle/*` scope. Repository: `github.com/uniweb/csl`.

**Core idea**: Instead of interpreting CSL XML at runtime (like citeproc-js does), compile the style once at build time into a JS module that directly formats citations. The style *becomes* the code.

**Design document**: `kb/csl-compiler.md` — the comprehensive plan covering architecture, CSL spec coverage, implementation phases, design decisions, and the web display styles vision. Read this first when starting implementation work.

## Package Architecture

```
packages/
├── compiler/     # @citestyle/compiler — CSL XML → JS module (build tool, Node.js)
├── core/         # @citestyle/core — shared runtime helpers (~6-8KB)
├── registry/     # @citestyle/registry — citation state (~5-8KB)
├── styles/       # @citestyle/styles — pre-compiled popular styles (~3-5KB each)
├── bibtex/       # @citestyle/bibtex — BibTeX ↔ CSL-JSON parser
└── types/        # @citestyle/types — TypeScript type definitions
```

### Package roles

| Package | Runtime? | Purpose |
|---|---|---|
| **compiler** | No (build tool) | Parses CSL XML, resolves macros/locales, emits JS modules |
| **core** | Yes (~6-8KB) | Name formatting, date formatting, text-case, ordinals, page ranges, HTML escaping. Imported by all compiled styles. |
| **registry** | Yes (~5-8KB) | Tracks cross-citation state: year-suffix assignment, citation numbering, bibliography sorting, subsequent-author-substitute |
| **styles** | Yes (~3-5KB each) | Pre-compiled popular styles (APA, MLA, Chicago, IEEE, etc.). Built by running the compiler on official CSL files. |
| **bibtex** | Yes | BibTeX ↔ CSL-JSON conversion |
| **types** | No (types only) | TypeScript definitions for CslItem, CslName, CslDate, FormattedEntry, CompiledStyle, Registry |

### Key dependency flow

```
Compiled Style (apa.js) ──imports──→ @citestyle/core
                ↑
@citestyle/compiler (build time)
                ↑
            .csl XML + locale XML

@citestyle/registry ──imports──→ @citestyle/core
                     ──uses────→ Compiled Style
```

### Structured output

Every formatted entry returns four representations:

```javascript
{
  html: '...',   // Semantic HTML with CSS classes and clickable links
  parts: {...},  // Decomposed fields for custom layouts (cards, profiles)
  links: {...},  // Extracted DOI, URL, PDF links
  text: '...'    // Plain text for copy-paste and accessibility
}
```

`parts` is a raw field extraction (CSL variable names), not a style-aware decomposition. Use `html`/`text` for style-correct output; use `parts` for building alternative layouts where the arrangement is custom.

## Commands

```bash
pnpm install          # Install + link local packages
pnpm build            # Build all packages
pnpm test             # Run tests across all packages (vitest)
pnpm lint             # Lint all packages
```

## Implementation Status

### v0.1 — Core pipeline (complete)
Parser → codegen → compiled APA output. Core helpers for names, dates, text-case, numbers, pages. 69 tests.

### v0.2 — Multi-style + structured output (complete)
- **5 styles compile correctly**: APA, MLA 9th, Chicago Author-Date, IEEE, Vancouver
- **Structured output**: `{ text, html }` — HTML with `<i>`, `<b>`, CSS classes (`csl-entry`, `csl-citation`, `csl-doi`, `csl-url`, `csl-sc`, `csl-ul`), auto-linked DOIs/URLs
- **Formatting tokens**: PUA characters U+E000-E007 embedded in text during rendering, converted to HTML tags by `toHtml()` or stripped by `stripFormatting()` for plain text
- **CSL test suite runner**: 16 fixtures passing, validates individual constructs against the reference implementation
- **Locator support**: `<text variable="locator"/>` and `<label variable="locator"/>` work in citation layouts with plural detection
- **113 tests total** across 10 test files

### v0.3 — Registry + semantic HTML + compiler gaps (complete)
- **Citation registry** (`@citestyle/registry`): `createRegistry(style)` → `addItems()`, `cite()`, `getBibliography()`. Citation-number assignment, bibliography sorting, subsequent-author-substitute.
- **Semantic HTML**: Every CSL variable wrapped in `<span class="csl-{variable}">` — enables CSS theming of individual fields (`.csl-author`, `.csl-title`, `.csl-container-title`, `.csl-issued`, `.csl-volume`, `.csl-page`, `.csl-DOI`, etc.)
- **Name-part text-case**: `<name-part name="family" text-case="uppercase"/>` now compiles correctly — name parts get text-case and font formatting
- **delimiter-precedes-et-al**: Full support for contextual/always/never/after-inverted-name modes
- **et-al-use-last**: Fixed "A, B, … Z" ellipsis pattern (no "and" connector before last name)
- **Citation non-mutation**: `cite()` no longer mutates original item objects when locators are present
- **147 tests total** across 11 test files (22 name, 14 HTML, 12 registry, 30 style, 17 CSL fixtures)

### v0.4 — More styles + year-suffix + test expansion (complete)
- **10 styles compile correctly**: Added Harvard (Cite Them Right), AMA 11th, Nature, Science, ACS 2022 to existing 5 (APA, MLA, Chicago, IEEE, Vancouver)
- **Year-suffix disambiguation**: Registry detects author+year collisions and assigns a/b/c suffixes via `item['year-suffix']`. Compiled styles read this variable. Triggered by `disambiguate-add-year-suffix="true"` exposed in meta.
- **match="none" condition fix**: Multi-value test attributes (e.g., `variable="page volume"`) no longer double-negate — flattened all checks before applying match mode once.
- **second-field-align**: Bibliography `second-field-align="flush"` now separates citation number from entry body with proper spacing. PUA-aware to avoid double spaces when suffix already includes whitespace.
- **vertical-align="sup"**: Citation layouts with `vertical-align="sup"` now wrap output in `<sup>` tags in HTML.
- **Bare DOI auto-linking**: `toHtml()` now links `doi:10.xxx` and `doi: 10.xxx` patterns (not just `https://doi.org/` URLs). Covers IEEE, AMA, and similar styles.
- **Structured output audit**: All 10 styles verified for consistent semantic CSS classes, clean text output (no PUA leakage), parts/links extraction, and DOI auto-linking.
- **211 tests total** across 11 test files (69 core, 80 compiler, 17 registry, 45 CSL fixtures)

### Next: v0.5 — Nocase spans + more disambiguation
- Nocase span support for text-case transforms
- Full name disambiguation (add-names, add-givenname)
- Cite collapsing for numeric styles
- 5 more styles (ABNT, Springer, Elsevier, APA-CV, Chicago Notes)

## Technical Decisions

- **ESM only** — `"type": "module"` throughout. Node >= 20.19, pnpm >= 9.
- **Plain JavaScript source** with JSDoc type annotations. TypeScript definitions in `@citestyle/types`.
- **vitest** for testing across all packages.
- **No framework dependency** — the engine packages (compiler, core, registry, styles) are pure JS. Framework bindings (React, etc.) live elsewhere (e.g., `@uniweb/scholar`).

## CSL Spec Reference

The CSL 1.0.2 specification defines ~50 XML elements. Key complexity areas:

- **Names**: et-al truncation, particles (von, de la), sort-order, delimiter-precedes-last, initialize-with, substitute chains
- **Dates**: localized vs non-localized forms, date-part formatting, ranges, seasons
- **Groups**: suppress entire group when all called variables are empty (no dangling delimiters)
- **Conditionals**: type, variable, is-numeric, match modes (any/all/none)
- **Macros**: inline at call sites, detect cycles, shared macros become named functions
- **Locale terms**: merge style overrides → locale file → en-US fallback, all resolved at compile time

### Name option resolution (important design pattern)

CSL name options (`et-al-min`, `et-al-use-first`, `and`, `delimiter-precedes-last`, etc.) cascade through three levels: **global** (style-level) → **section** (citation/bibliography) → **element** (`<name>` attributes). Macros are shared between citation and bibliography, so name options cannot be baked in at compile time — they must be resolved at runtime.

The compiled code uses a `_nameConfig(ctx, elementOpts)` function that merges: `NAME_OPTS` (global) → `ctx._secOpts` (section, set by citation/bibliography) → `elementOpts` (element-level). The `??` (nullish coalescing) operator is used throughout to preserve empty strings and `false` values.

### Attribute empty-string handling

XML attributes with value `""` (like `initialize-with=""` in Vancouver) must be distinguished from absent attributes. The parser uses `el.hasAttribute(name)` — not just `el.getAttribute(name) || null` — because empty strings are falsy but semantically meaningful. Similarly, `??` (not `||`) is used when merging options to preserve empty string values.

### What the compiler does NOT handle (deferred)

- ibid / subsequent position / near-note (footnote-centric)
- Full name disambiguation (complex, low value for web)
- Cite collapsing (numeric ranges, author grouping)
- CSL-M extensions (legal/multilingual — different spec)

These are architecturally possible as registry plugins but not needed for web rendering.

## Web Display Styles

Citestyle separates WHAT to show (CSL formatting) from HOW to show it (web presentation):

| Display Style | Use Case |
|---|---|
| `compact` | Article bibliographies, blog references — enhanced traditional list |
| `card` | Publication pages, research profiles — structured cards with asset buttons |
| `minimal` | CVs, dense publication lists — maximum density |
| `rich` | Research portals, lab websites — full metadata, expandable sections |

## Relationship to Uniweb

Citestyle is an **independent, vendor-neutral project** — the engine packages have no Uniweb dependency. The Uniweb integration layer is `@uniweb/scholar` (in the Uniweb workspace), which imports from `@citestyle/*` packages and provides React components (CitationProvider, Bibliography, Citation, PublicationCard, etc.).

When working on `@uniweb/scholar` integration, the relevant code is in the Uniweb workspace at `packages/scholar/`.

## Formatting Token Design

Compiled styles use Unicode Private Use Area characters (U+E000-E007) as formatting tokens embedded in the text output pipeline. This avoids premature HTML generation during rendering — the tokens are neutral markers that get converted at the final output stage:

| Token | Meaning | HTML output |
|---|---|---|
| U+E000 / U+E001 | Italic start/end | `<i>` / `</i>` |
| U+E002 / U+E003 | Bold start/end | `<b>` / `</b>` |
| U+E004 / U+E005 | Small-caps start/end | `<span class="csl-sc">` / `</span>` |
| U+E006 / U+E007 | Underline start/end | `<span class="csl-ul">` / `</span>` |
| U+E020 | Semantic span open | Followed by class name (e.g., `author`) |
| U+E021 | Semantic separator | Separates class name from content |
| U+E022 | Semantic span close | `</span>` |

Semantic spans encode per-variable CSS classes: `\uE020author\uE021John Smith\uE022` → `<span class="csl-author">John Smith</span>`. This enables CSS theming of individual fields without premature HTML generation.

- `toHtml(str)` — converts tokens to HTML tags, also auto-links DOIs and URLs. **Processing order matters**: escape HTML → auto-link DOI URLs → auto-link bare DOIs (`doi:10.xxx`) → auto-link URLs → convert formatting tokens → convert semantic tokens.
- `stripFormatting(str)` — removes all PUA tokens (formatting + semantic) for clean plain text
- Punctuation normalization (`_normalizePunctuation`) is PUA-aware — won't break on tokens between dots. The F pattern includes ranges `\uE000-\uE007` and `\uE020-\uE022`.

## HTML Escaping

**Every variable interpolation in HTML output must be escaped** via `escapeHtml()` from `@citestyle/core`. Titles, author names, publisher names — all user-provided data. The `text` output doesn't need escaping. The `parts` object contains raw values (frameworks like React handle their own escaping).

## Testing

Four test layers:

1. **Unit tests** (`packages/core/test/`) — Core helpers (names 22, dates 8, text-case 10, numbers 6, pages 6, HTML 17). 69 tests.

2. **Compiler tests** (`packages/compiler/test/`) — Parser (11), compilation (11), style integration for 10 real styles (58). 80 tests.

3. **CSL test suite fixtures** (`test/csl-suite.test.js`, `test/csl-fixtures/`) — Adapted from `github.com/citation-style-language/test-suite`. Each fixture has MODE, CSL, INPUT, RESULT sections; some also have CITATION-ITEMS (per-cite locator data). The runner compiles the embedded CSL, feeds INPUT, compares `.text` output against RESULT. 45 fixtures covering: names (particles, initials, hyphenated, form, et-al, substitute, literal, 3-author), groups (suppression, delimiter, nesting), conditions (type, variable, is-numeric, match all/any/none), dates (month, accessed, range, season, short form), numbers (ordinal, roman), labels (short, empty, plural), affixes, decorations (italic, bold, quotes), text-case, macros, strip-periods, static text values, sort keys. Auto-skips deferred features.

4. **Registry integration tests** (`packages/registry/test/registry.test.js`) — Registry API with compiled styles (APA, IEEE, MLA), citation numbering, bibliography sorting, subsequent-author-substitute, year-suffix disambiguation. 17 tests.

Run all tests: `npx vitest run` (211 tests, ~800ms).

### Known limitations (skip markers in test runner)
- `position=`, `ibid` — footnote-centric features
- `disambiguate-add-names`, `disambiguate-add-givenname` — name disambiguation (year-suffix IS supported)
- `collapse=` — cite collapsing
- `<span class="nocase">` — case-protection in variable values
