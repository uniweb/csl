# @citestyle/ris

RIS parser and serializer. Converts between RIS (Research Information Systems) tagged format and CSL-JSON, the standard input format for Citestyle.

## Installation

```bash
npm install @citestyle/ris
```

## Usage

### Parse RIS to CSL-JSON

```js
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
console.log(items[0].title)            // "A Study of Climate Change"
console.log(items[0].author.length)    // 2
console.log(items[0].page)             // "100-108"
console.log(items[0].DOI)              // "10.1038/example"
```

### Export CSL-JSON to RIS

```js
import { exportRis } from '@citestyle/ris'

const items = [{
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
}]

const output = exportRis(items)
// TY  - JOUR
// AU  - Smith, John
// AU  - Doe, Jane
// TI  - A Study of Climate Change
// ...
// ER  -
```

### Pipeline: RIS to formatted bibliography

```js
import { parseRis } from '@citestyle/ris'
import { createRegistry } from '@citestyle/registry'
import * as apa from '@citestyle/styles/apa'

const ris = readFileSync('export.ris', 'utf-8')
const items = parseRis(ris)

const registry = createRegistry(apa)
registry.addItems(items)

const bibliography = registry.getBibliography()
bibliography.forEach(entry => console.log(entry.html))
```

## API

### `parseRis(str)`

Parse a RIS string into an array of CSL-JSON items.

**Features:**
- 30+ RIS type codes (JOUR, BOOK, CHAP, THES, CONF, RPRT, etc.)
- Repeatable tags (AU for multiple authors, KW for keywords)
- SP + EP page merging into a single page range
- Date parsing from PY and DA tags
- Editor (A2/ED), translator, and other contributor roles
- Common in exports from PubMed, Scopus, Web of Science, and Zotero

### `exportRis(items)`

Serialize an array of CSL-JSON items to a RIS string. Each item is delimited by `TY` (type) and `ER` (end of record) tags.
