# @citestyle/styles

Nine popular citation styles, pre-compiled and ready to import. Each style is ~3-5KB — a compiled JavaScript module that formats citations and bibliographies as pure function calls with zero runtime overhead.

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
| `@citestyle/styles/chicago-author-date` | Chicago Manual of Style 18th ed. | Author-date |
| `@citestyle/styles/harvard` | Harvard — Cite Them Right 12th ed., in British English | Author-date |
| `@citestyle/styles/ieee` | IEEE | Numeric |
| `@citestyle/styles/vancouver` | Vancouver | Numeric |
| `@citestyle/styles/ama` | American Medical Association 11th ed. | Numeric |
| `@citestyle/styles/nature` | Nature | Numeric |
| `@citestyle/styles/science` | Science | Numeric |

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

### In another language

Each style formats in every official CSL language: pass a locale pack from [`@citestyle/locales`](../locales).

```javascript
import { format } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'
import de from '@citestyle/locales/de-DE'

const book = {
  type: 'book', title: 'The art of computer programming', author: [{ family: 'Knuth', given: 'Donald Ervin' }],
  issued: { 'date-parts': [[1997]] }, publisher: 'Addison-Wesley', edition: '3', volume: '1',
}

format(apa, book, { locale: de }).text
// Knuth, D. E. (1997). The art of computer programming (3. Aufl., Bd. 1). Addison-Wesley.
```

Terms ("und", "Hrsg.", "S."), ordinals ("2. Aufl."), month names, date formats and quotation marks („…“) follow the pack. Without `locale`, a style formats in its default locale, resolved the same way.

Cite Them Right is a British guide, but its style names no default locale, so `harvard` is compiled with British English (en-GB) as its default: without a pack it writes "(Accessed: 1 March 2024)", ‘single quotes’ with the comma outside them, and "3rd edn.". Pass `@citestyle/locales/en-US` for American English.

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
apa.meta.title  // "APA Style 7th edition"
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

## Source and license

Each style is the work of the [Citation Style Language](https://citationstyles.org/) project's contributors: a style from the official [CSL styles repository](https://github.com/citation-style-language/styles), compiled by [`@citestyle/compiler`](../compiler). The styles are licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported license](https://creativecommons.org/licenses/by-sa/3.0/) (CC BY-SA 3.0), and so are the modules compiled from them. Every module opens with its style's notice, in a `/*! … */` comment that minifiers keep: the style's title and link, its authors and contributors, and its rights.

| Module | Style |
|---|---|
| `apa` | [APA Style 7th edition](http://www.zotero.org/styles/apa) |
| `mla` | [MLA Handbook 9th edition (in-text citations)](http://www.zotero.org/styles/modern-language-association) |
| `chicago-author-date` | [Chicago Manual of Style 18th edition (author-date)](http://www.zotero.org/styles/chicago-author-date) |
| `harvard` | [Cite Them Right 12th edition (author-date/Harvard)](http://www.zotero.org/styles/harvard-cite-them-right) |
| `ieee` | [IEEE Reference Guide version 11.29.2023](http://www.zotero.org/styles/ieee) |
| `vancouver` | [Elsevier - NLM/Vancouver (citation-sequence)](http://www.zotero.org/styles/elsevier-vancouver) |
| `ama` | [AMA Manual of Style 11th edition](http://www.zotero.org/styles/american-medical-association) |
| `nature` | [Nature](http://www.zotero.org/styles/nature) |
| `science` | [Science](http://www.zotero.org/styles/science) |

The package's own code is MIT-licensed; its `package.json` says `MIT AND CC-BY-SA-3.0`.
