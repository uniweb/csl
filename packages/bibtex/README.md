# @citestyle/bibtex

BibTeX parser and serializer. Converts between BibTeX and CSL-JSON, the standard input format for Citestyle.

## Installation

```bash
npm install @citestyle/bibtex
```

## Usage

### Parse BibTeX to CSL-JSON

```js
import { parseBibtex } from '@citestyle/bibtex'

const bibtex = `
@article{smith2024,
  author = {Smith, John and de la Cruz, Maria},
  title = {A Study of {DNA} Replication},
  journal = {Nature},
  year = {2024},
  volume = {620},
  pages = {100--108},
  doi = {10.1038/example}
}
`

const items = parseBibtex(bibtex)
console.log(items[0].title)              // "A Study of DNA Replication"
console.log(items[0].author[0].family)   // "Smith"
console.log(items[0].author[1]['non-dropping-particle']) // "de la"
console.log(items[0].page)               // "100-108"
```

### Export CSL-JSON to BibTeX

```js
import { exportBibtex } from '@citestyle/bibtex'

const items = [{
  id: 'smith2024',
  type: 'article-journal',
  title: 'A Study of DNA Replication',
  author: [{ family: 'Smith', given: 'John' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature',
  volume: '620',
  page: '100-108',
  DOI: '10.1038/example',
}]

const output = exportBibtex(items)
// @article{smith2024,
//   author = {Smith, John},
//   title = {A Study of DNA Replication},
//   journal = {Nature},
//   ...
// }
```

### Convert LaTeX commands to Unicode

```js
import { convertLatex } from '@citestyle/bibtex'

convertLatex("Universit\\\"at M\\\"unchen") // "Universitat Munchen" → "Universitat München"
convertLatex("Sch\\\"onfinkel")              // "Schonfinkel" → "Schönfinkel"
convertLatex("{\\ss}")                       // "ß"
convertLatex("\\o")                          // "ø"
```

### Pipeline: BibTeX to formatted bibliography

```js
import { parseBibtex } from '@citestyle/bibtex'
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const bibtex = readFileSync('references.bib', 'utf-8')
const items = parseBibtex(bibtex)

const registry = createRegistry(apa)
registry.addItems(items)

const bibliography = registry.getBibliography()
bibliography.forEach(entry => console.log(entry.html))
```

## API

### `parseBibtex(str)`

Parse a BibTeX string into an array of CSL-JSON items.

**Supported entry types:** `@article`, `@book`, `@inproceedings`, `@incollection`, `@inbook`, `@phdthesis`, `@mastersthesis`, `@misc`, `@techreport`, `@unpublished`, `@proceedings`, `@manual`, `@conference`, `@booklet`, `@online`.

**Features:**
- LaTeX accent/command conversion (120+ mappings)
- `@string` abbreviation expansion
- `#` concatenation of string values
- Braced and quoted string values
- Month abbreviations (jan-dec)
- Name parsing with particles (`von`, `de`, `de la`) and suffixes (`Jr.`, `III`)
- Corporate/institutional authors via double braces (`{{World Health Organization}}`)
- Nested brace stripping

### `exportBibtex(items)`

Serialize an array of CSL-JSON items to a BibTeX string. Produces clean output with en-dash page ranges and proper name formatting.

### `convertLatex(str)`

Convert LaTeX accent sequences and special commands to Unicode characters. Handles `\"`, `\'`, `\^`, `\~`, `\c`, `\v`, and special commands like `\ss`, `\o`, `\ae`.
