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

## HTML Escaping

**Every variable interpolation in HTML output must be escaped** via `escapeHtml()` from `@citestyle/core`. Titles, author names, publisher names — all user-provided data. The `text` output doesn't need escaping. The `parts` object contains raw values (frameworks like React handle their own escaping).

## Testing

The CSL project maintains a test suite at `github.com/citation-style-language/test-suite` with ~654 fixtures. Each fixture has: MODE (citation/bibliography), CSL (embedded style), INPUT (CSL-JSON items), RESULT (expected output).

Our test runner should: compile the embedded CSL, feed INPUT, compare `.text` output against RESULT. Tests for deferred features (ibid, disambiguation) are skipped with markers.
