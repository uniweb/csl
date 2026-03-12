# @citestyle/styles

Pre-compiled popular CSL styles, ready to use. Each style is ~3-5KB and imports shared helpers from `@citestyle/core`.

## Installation

```bash
npm install @citestyle/styles
```

## Available Styles

| Import path | Style |
|---|---|
| `@citestyle/styles/apa` | American Psychological Association 7th edition |
| `@citestyle/styles/mla` | Modern Language Association 9th edition |
| `@citestyle/styles/chicago-author-date` | Chicago Manual of Style 17th edition (author-date) |
| `@citestyle/styles/ieee` | IEEE |
| `@citestyle/styles/vancouver` | Vancouver |
| `@citestyle/styles/harvard` | Harvard (Cite Them Right) |
| `@citestyle/styles/ama` | American Medical Association 11th edition |
| `@citestyle/styles/turabian` | Turabian 9th edition |
| `@citestyle/styles/nature` | Nature |
| `@citestyle/styles/science` | Science |

## Usage

### Direct (without registry)

```js
import * as apa from '@citestyle/styles/apa'

const item = {
  id: '1',
  type: 'article-journal',
  title: 'A theory of everything',
  author: [{ family: 'Einstein', given: 'Albert' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Physical Review Letters',
  volume: '130',
  page: '1-10',
  DOI: '10.1103/example',
}

const entry = apa.bibliography(item)
console.log(entry.text)
console.log(entry.html)
```

### With registry (recommended for documents)

```js
import * as ieee from '@citestyle/styles/ieee'
import { createRegistry } from '@citestyle/registry'

const registry = createRegistry(ieee)
registry.addItems([item1, item2, item3])

const citation = registry.cite([{ id: '1' }])
console.log(citation.text) // [1]

const bibliography = registry.getBibliography()
bibliography.forEach(e => console.log(e.html))
```

### Style metadata

Every style exports a `meta` object:

```js
import * as apa from '@citestyle/styles/apa'

console.log(apa.meta.id)    // "apa"
console.log(apa.meta.title) // "American Psychological Association 7th edition"
console.log(apa.meta.class) // "in-text"
```

## Custom Styles

For styles not included here, compile any CSL file with `@citestyle/compiler`:

```bash
npm install @citestyle/compiler
citestyle compile my-style.csl -o my-style.js
```

Then import the output module the same way:

```js
import * as myStyle from './my-style.js'
```

## Output Format

Every `bibliography(item)` call returns:

```js
{
  text: '...',   // Plain text
  html: '...',   // Semantic HTML with CSS classes and linked DOIs
  parts: {...},  // Decomposed fields for custom layouts
  links: {...},  // Extracted DOI, URL, PDF links
}
```

Every `citation(cites)` call returns:

```js
{
  text: '...',   // Plain text (e.g., "(Smith, 2024)")
  html: '...',   // HTML with <span class="csl-citation">
}
```
