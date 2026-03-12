# @citestyle/registry

Citation registry that manages cross-citation state for a compiled CSL style. Handles citation numbering, bibliography sorting, year-suffix disambiguation, name disambiguation, cite collapsing, and subsequent-author-substitute.

## Installation

```bash
npm install @citestyle/registry
```

## Usage

```js
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

// Create a registry bound to a compiled style
const registry = createRegistry(apa)

// Add items (assigns citation numbers, triggers disambiguation)
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

// Format an inline citation
const citation = registry.cite([{ id: 'smith2024' }])
console.log(citation.text) // (Smith, 2024)
console.log(citation.html) // <span class="csl-citation">(Smith, 2024)</span>

// Citation with locator
const withPage = registry.cite([
  { id: 'smith2024', locator: '105', label: 'page' },
])
console.log(withPage.text) // (Smith, 2024, p. 105)

// Multi-cite
const multi = registry.cite([
  { id: 'smith2024' },
  { id: 'doe2023' },
])
console.log(multi.text) // (Doe, 2023; Smith, 2024)

// Get the full bibliography (sorted per style rules)
const entries = registry.getBibliography()
for (const entry of entries) {
  console.log(entry.text) // Plain text
  console.log(entry.html) // Semantic HTML with CSS classes
}

// Check registry size
console.log(registry.size) // 2
```

## API

### `createRegistry(style, options?)`

Create a new registry for a compiled CSL style.

- `style` -- A compiled style module (must export `bibliography` or `citation`)
- `options.subsequentAuthorSubstitute` (string) -- Override the style's substitute string (e.g., `"---"`)

Returns a `Registry` object.

### Registry Methods

#### `addItems(items)`

Add CSL-JSON items to the registry. Items are stored by `id` and assigned citation numbers in insertion order. Duplicate IDs update the existing item.

#### `getItem(id)`

Look up a single item by ID. Returns `undefined` if not found.

#### `cite(cites, ctx?)`

Format a citation cluster. Each cite object can include:

| Property | Type | Description |
|---|---|---|
| `id` | string | Item ID (resolved from registry) |
| `item` | CslItem | Pre-resolved item (bypasses lookup) |
| `locator` | string | Locator value (e.g., page number) |
| `label` | string | Locator label (`'page'`, `'chapter'`, etc.) |
| `prefix` | string | Text before the citation |
| `suffix` | string | Text after the citation |

Returns `{ text: string, html: string }`.

#### `getBibliography(ctx?)`

Get the formatted bibliography. Items are sorted per the style's sort rules. Returns an array of `FormattedEntry` objects, each with `{ text, html, parts, links }`.

#### `size`

Read-only property returning the number of items in the registry.

## Features

- **Citation numbering**: Numeric styles (IEEE, Vancouver) get auto-assigned numbers
- **Bibliography sorting**: Uses the style's compiled sort comparator
- **Year-suffix**: Detects author+year collisions and assigns a/b/c suffixes
- **Name disambiguation**: `disambiguate-add-givenname` (5 rules) and `disambiguate-add-names`
- **Cite collapsing**: Numeric ranges (`[1-3, 5]`) and author-date grouping (`Smith, 2020, 2021`)
- **Subsequent-author-substitute**: Replaces repeated authors in bibliography (e.g., with em-dash)
