# @citestyle/registry

Citation registry for managing cross-reference state across a document. When you have multiple citations and need them to interact — numbered references, year-suffix disambiguation (Smith 2024a, 2024b), cite collapsing ([1-3, 5]), sorted bibliographies — the registry handles it.

For one-off formatting where citations don't interact, this package also exports a simpler `format()` API that needs no setup.

## Installation

```bash
npm install @citestyle/registry
```

## Quick start

```javascript
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const registry = createRegistry(apa)

registry.addItems([
  {
    id: 'smith2024',
    type: 'article-journal',
    title: 'Machine learning in practice',
    author: [{ family: 'Smith', given: 'Jane' }],
    issued: { 'date-parts': [[2024]] },
    'container-title': 'Nature',
    volume: '620',
    page: '100-108',
    DOI: '10.1038/example',
  },
  {
    id: 'doe2023',
    type: 'book',
    title: 'Statistical Methods',
    author: [{ family: 'Doe', given: 'John' }],
    issued: { 'date-parts': [[2023]] },
    publisher: 'Academic Press',
  },
])

// Inline citation
registry.cite([{ id: 'smith2024' }])
// → { text: '(Smith, 2024)', html: '<span class="csl-citation">...</span>' }

// Citation with page locator
registry.cite([{ id: 'smith2024', locator: '105', label: 'page' }])
// → { text: '(Smith, 2024, p. 105)', html: '...' }

// Multi-cite (sorted per style rules)
registry.cite([{ id: 'smith2024' }, { id: 'doe2023' }])
// → { text: '(Doe, 2023; Smith, 2024)', html: '...' }

// Full bibliography — sorted, numbered, disambiguated
const entries = registry.getBibliography()
entries[0].text   // Plain text
entries[0].html   // Semantic HTML with CSS classes and linked DOIs
entries[0].parts  // Decomposed fields for custom layouts
entries[0].links  // Extracted DOI, URL links
```

## Simple API (no registry)

When you just need to format one or a few items and don't need cross-reference features:

```javascript
import { format, formatAll, formatCitation } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

// Single bibliography entry
const entry = format(apa, item)
// → { html, text, parts, links }

// Multiple entries (sorted per style rules, auto-numbered)
const entries = formatAll(apa, [item1, item2, item3])

// Single inline citation
const cite = formatCitation(apa, [{ item, locator: '42', label: 'page' }])
// → { html, text }
```

Use `createRegistry()` instead when you need any of the cross-reference features below.

## When to use the registry vs. `format()`

| Feature | `format()` | `createRegistry()` |
|---|---|---|
| Format a bibliography entry | Yes | Yes |
| Format a citation | Yes | Yes |
| Sort bibliography | Yes | Yes |
| Citation numbering (IEEE, Vancouver) | No | Yes |
| Year-suffix disambiguation (2024a, 2024b) | No | Yes |
| Name disambiguation (expand initials/names) | No | Yes |
| Cite collapsing ([1-3] or "Smith 2020, 2021") | No | Yes |
| Subsequent-author-substitute (em-dash) | No | Yes |

**Rule of thumb**: use `format()` for publication lists, portfolio pages, and anywhere each entry stands alone. Use `createRegistry()` for documents — papers, articles, blog posts — where citations reference and interact with each other.

## API

### `createRegistry(style, options?)`

Create a new registry bound to a compiled style.

- `style` — A compiled style module (from `@citestyle/styles/*` or your own compiled `.js`)
- `options.subsequentAuthorSubstitute` (string) — Override the style's substitute string (e.g., `"---"`)

### `registry.addItems(items)`

Add CSL-JSON items. Items are stored by `id` and assigned citation numbers in insertion order. Adding an item with a duplicate ID updates the existing entry.

### `registry.getItem(id)`

Look up a single item by ID. Returns `undefined` if not found.

### `registry.cite(cites, ctx?)`

Format a citation cluster. Each cite can include:

| Property | Type | Description |
|---|---|---|
| `id` | string | Item ID (looked up from registry) |
| `item` | CslItem | Pre-resolved item (bypasses lookup) |
| `locator` | string | Locator value (page number, chapter, etc.) |
| `label` | string | Locator label: `'page'`, `'chapter'`, `'section'`, etc. |
| `prefix` | string | Text inserted before the citation |
| `suffix` | string | Text appended after the citation |

Returns `{ text: string, html: string }`.

### `registry.getBibliography(ctx?)`

Get the full formatted bibliography. Items are sorted per the style's sort rules. Returns an array of `FormattedEntry` objects:

```javascript
{
  text: string,     // Plain text
  html: string,     // Semantic HTML with CSS classes and auto-linked DOIs
  parts: object,    // Decomposed fields (authors, year, title, ...)
  links: object,    // Extracted links (doi, url)
}
```

### `registry.size`

Read-only property: number of items in the registry.

### `format(style, item, ctx?)`

Format a single bibliography entry without a registry. Returns `{ text, html, parts, links }`.

### `formatAll(style, items, ctx?)`

Format multiple bibliography entries. Applies the style's sort order and assigns citation numbers. Returns an array of `{ text, html, parts, links }`.

### `formatCitation(style, cites, ctx?)`

Format a single citation cluster without a registry. Each cite must include an `item` property (not an `id`, since there's no registry to look it up from). Returns `{ text, html }`.

## What the registry handles automatically

- **Citation numbering** — Numeric styles (IEEE, Vancouver) get auto-assigned `[1]`, `[2]`, etc. in insertion order
- **Bibliography sorting** — Uses the style's compiled sort comparator (alphabetical for APA, insertion-order for IEEE, etc.)
- **Year-suffix disambiguation** — When two items share the same author(s) and year, the registry assigns suffixes: Smith (2024a), Smith (2024b)
- **Name disambiguation** — Expands initials or adds names to distinguish ambiguous citations, following the style's `disambiguate-add-givenname` rules (5 rule variants supported)
- **Cite collapsing** — Numeric ranges: `[1, 2, 3, 5]` → `[1-3, 5]`. Author-date grouping: `(Smith 2020; Smith 2021)` → `(Smith 2020, 2021)`
- **Subsequent-author-substitute** — Replaces repeated authors in the bibliography with a dash or other substitute string, per the style's rules
