# @citestyle/styles

The 10 most popular citation styles, pre-compiled and ready to import. Each style is ~3-5KB — a compiled JavaScript module that formats citations and bibliographies as pure function calls with zero runtime overhead.

These are the same styles you'd get by running the `@citestyle/compiler` on official `.csl` files, just pre-built so you can `npm install` and go.

## Installation

```bash
npm install @citestyle/styles
```

Requires `@citestyle/core` as a peer dependency (installed automatically).

## Available styles

| Import | Style | Class |
|---|---|---|
| `@citestyle/styles/apa` | American Psychological Association 7th ed. | Author-date |
| `@citestyle/styles/mla` | Modern Language Association 9th ed. | Author-date |
| `@citestyle/styles/chicago-author-date` | Chicago Manual of Style 17th ed. | Author-date |
| `@citestyle/styles/harvard` | Harvard — Cite Them Right 12th ed. | Author-date |
| `@citestyle/styles/ieee` | IEEE | Numeric |
| `@citestyle/styles/vancouver` | Vancouver | Numeric |
| `@citestyle/styles/ama` | American Medical Association 11th ed. | Numeric |
| `@citestyle/styles/nature` | Nature | Numeric |
| `@citestyle/styles/science` | Science | Numeric |
| `@citestyle/styles/turabian` | Turabian 9th ed. | Author-date |

**Need a different style?** Any of the 10,000+ `.csl` files from the [official CSL repository](https://github.com/citation-style-language/styles) can be compiled with [`@citestyle/compiler`](../compiler):

```bash
npx citestyle compile my-journal.csl -o my-journal.js
```

## Usage

### Simplest: one-off formatting

```javascript
import { format, formatCitation } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const item = {
  id: '1',
  type: 'article-journal',
  title: 'Deep learning for protein structure prediction',
  author: [{ family: 'Jumper', given: 'John' }],
  issued: { 'date-parts': [[2021]] },
  'container-title': 'Nature',
  volume: '596',
  page: '583-589',
  DOI: '10.1038/s41586-021-03819-2',
}

// Bibliography entry
const entry = format(apa, item)
entry.text   // Jumper, J. (2021). Deep learning for protein structure prediction. Nature, 596, 583–589.
entry.html   // Semantic HTML with CSS classes (.csl-author, .csl-title, ...) and linked DOI
entry.parts  // { authors, year, title, container, volume, page, doi }
entry.links  // { doi: 'https://doi.org/10.1038/s41586-021-03819-2' }

// Inline citation
const cite = formatCitation(apa, [{ item }])
cite.text    // (Jumper, 2021)
```

### With a registry (for documents)

When your document has multiple citations that need to interact — numbering, disambiguation, sorting — use a registry:

```javascript
import { createRegistry } from '@citestyle/registry'
import * as ieee from '@citestyle/styles/ieee'

const registry = createRegistry(ieee)
registry.addItems([item1, item2, item3])

// Citations are auto-numbered
registry.cite([{ id: 'jumper2021' }])
// → { text: '[1]', html: '...' }

// Bibliography is sorted per IEEE rules
const bibliography = registry.getBibliography()
bibliography.forEach(entry => {
  console.log(entry.html)  // [1] J. Jumper, "Deep learning for..."
})
```

### Direct function calls (no registry, no helpers)

Every style module exports `bibliography()` and `citation()` as pure functions:

```javascript
import * as apa from '@citestyle/styles/apa'

const entry = apa.bibliography(item)  // → { text, html, parts, links }
const cite = apa.citation([{ item }]) // → { text, html }
```

### Style metadata

Every style exports a `meta` object with information from the CSL source:

```javascript
import * as apa from '@citestyle/styles/apa'

apa.meta.id     // "apa"
apa.meta.title  // "American Psychological Association 7th edition"
apa.meta.class  // "in-text"
```

## Output format

**Bibliography entries** return four representations:

```javascript
{
  text: '...',    // Plain text — for copy-paste, accessibility, search indexing
  html: '...',    // Semantic HTML — CSS classes per field, auto-linked DOIs
  parts: { ... }, // Decomposed fields — for building cards, profiles, custom layouts
  links: { ... }, // Extracted links — DOI, URL, ready for buttons/badges
}
```

**Citations** return two:

```javascript
{
  text: '...',    // Plain text — "(Smith, 2024)" or "[1]"
  html: '...',    // HTML — <span class="csl-citation">...</span>
}
```
