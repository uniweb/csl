# @citestyle/bibtex

Parse BibTeX files into CSL-JSON and export CSL-JSON back to BibTeX. Handles the real-world messiness of BibTeX: LaTeX accent commands, `@string` abbreviations, `#` concatenation, name particles (von, de la), suffixes (Jr., III), and corporate authors.

Use this to bring BibTeX references into the Citestyle formatting pipeline, or to export formatted bibliographies back to BibTeX for sharing with LaTeX users.

## Installation

```bash
npm install @citestyle/bibtex
```

## Parse BibTeX to CSL-JSON

```javascript
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

items[0].title                                // "A Study of DNA Replication"
items[0].author[0].family                     // "Smith"
items[0].author[1]['non-dropping-particle']    // "de la"
items[0].page                                 // "100-108"
items[0].DOI                                  // "10.1038/example"
```

## Export CSL-JSON to BibTeX

```javascript
import { exportBibtex } from '@citestyle/bibtex'

const output = exportBibtex([{
  id: 'smith2024',
  type: 'article-journal',
  title: 'A Study of DNA Replication',
  author: [{ family: 'Smith', given: 'John' }],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature',
  volume: '620',
  page: '100-108',
  DOI: '10.1038/example',
}])

// @article{smith2024,
//   author = {Smith, John},
//   title = {A Study of DNA Replication},
//   journal = {Nature},
//   year = {2024},
//   volume = {620},
//   pages = {100--108},
//   doi = {10.1038/example}
// }
```

## Full pipeline: BibTeX to formatted bibliography

```javascript
import { parseBibtex } from '@citestyle/bibtex'
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const items = parseBibtex(readFileSync('references.bib', 'utf-8'))

const registry = createRegistry(apa)
registry.addItems(items)

const bibliography = registry.getBibliography()
bibliography.forEach(entry => {
  console.log(entry.html)   // Semantic HTML with CSS classes and linked DOIs
  console.log(entry.text)   // Plain text for copy-paste
})
```

## LaTeX to Unicode conversion

```javascript
import { convertLatex } from '@citestyle/bibtex'

convertLatex('Universit\\"at M\\"unchen')   // "Universität München"
convertLatex('Sch\\"onfinkel')               // "Schönfinkel"
convertLatex('{\\ss}')                       // "ß"
convertLatex('\\o')                          // "ø"
convertLatex("Caf\\'e")                      // "Café"
```

120+ LaTeX accent and command mappings. Covers `\"`, `\'`, `\^`, `\~`, `\``, `\c`, `\v`, `\=`, `\H`, `\u`, `\d`, `\b`, `\k`, and special commands (`\ss`, `\o`, `\O`, `\ae`, `\AE`, `\aa`, `\AA`, `\l`, `\L`, `\i`, `\j`).

## API

### `parseBibtex(str) → CslItem[]`

Parse a BibTeX string into CSL-JSON items.

**Supported entry types**: `@article`, `@book`, `@inproceedings`, `@incollection`, `@inbook`, `@phdthesis`, `@mastersthesis`, `@misc`, `@techreport`, `@unpublished`, `@proceedings`, `@manual`, `@conference`, `@booklet`, `@online`

**Handles**:
- LaTeX accent and command conversion (120+ mappings)
- `@string` abbreviation expansion and `#` concatenation
- Braced and quoted string values, nested brace stripping
- Month abbreviations (`jan`–`dec`)
- Name parsing with particles (`von`, `de`, `de la`) and suffixes (`Jr.`, `III`)
- Corporate/institutional authors via double braces: `{{World Health Organization}}`

### `exportBibtex(items) → string`

Serialize CSL-JSON items to BibTeX. Produces clean output with en-dash page ranges (`--`) and proper name formatting.

### `convertLatex(str) → string`

Convert LaTeX accent sequences and special commands to Unicode characters. Useful when processing individual BibTeX field values outside of the full parser.
