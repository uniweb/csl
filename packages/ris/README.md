# @citestyle/ris

Parse RIS files into CSL-JSON and export CSL-JSON back to RIS. RIS (Research Information Systems) is the tagged format used by PubMed, Scopus, Web of Science, Zotero, and most reference managers for bulk export.

Use this to bring exported references into the Citestyle formatting pipeline, or to generate RIS files for sharing with other tools.

## Installation

```bash
npm install @citestyle/ris
```

## Parse RIS to CSL-JSON

```javascript
import { parseRis } from '@citestyle/ris'

const ris = `
TY  - JOUR
AU  - Smith, John
AU  - Doe, Jane
TI  - A Study of Climate Change
JF  - Nature Climate Change
PY  - 2024
VL  - 14
SP  - 100
EP  - 108
DO  - 10.1038/example
ER  -
`

const items = parseRis(ris)

items[0].title          // "A Study of Climate Change"
items[0].author.length  // 2
items[0].page           // "100-108"  (SP + EP merged automatically)
items[0].DOI            // "10.1038/example"
```

## Export CSL-JSON to RIS

```javascript
import { exportRis } from '@citestyle/ris'

const output = exportRis([{
  id: '1',
  type: 'article-journal',
  title: 'A Study of Climate Change',
  author: [
    { family: 'Smith', given: 'John' },
    { family: 'Doe', given: 'Jane' },
  ],
  issued: { 'date-parts': [[2024]] },
  'container-title': 'Nature Climate Change',
  volume: '14',
  page: '100-108',
  DOI: '10.1038/example',
}])

// TY  - JOUR
// AU  - Smith, John
// AU  - Doe, Jane
// TI  - A Study of Climate Change
// JF  - Nature Climate Change
// ...
// ER  -
```

## Full pipeline: RIS to formatted bibliography

```javascript
import { parseRis } from '@citestyle/ris'
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const items = parseRis(readFileSync('export.ris', 'utf-8'))

const registry = createRegistry(apa)
registry.addItems(items)

const bibliography = registry.getBibliography()
bibliography.forEach(entry => {
  console.log(entry.html)   // Semantic HTML with CSS classes and linked DOIs
  console.log(entry.text)   // Plain text for copy-paste
})
```

## API

### `parseRis(str) → CslItem[]`

Parse a RIS string into CSL-JSON items.

**Handles**:
- 30+ RIS type codes (`JOUR`, `BOOK`, `CHAP`, `THES`, `CONF`, `RPRT`, `GEN`, etc.)
- Repeatable tags (`AU` for multiple authors, `KW` for keywords)
- Automatic page merging from `SP` (start page) + `EP` (end page) tags
- Date parsing from `PY` and `DA` tags
- Editor (`A2`/`ED`), translator, and other contributor roles

**Compatible with exports from**: PubMed, Scopus, Web of Science, Zotero, Mendeley, EndNote, Google Scholar.

### `exportRis(items) → string`

Serialize CSL-JSON items to a RIS string. Each record is delimited by `TY` (type) and `ER` (end of record) tags.
