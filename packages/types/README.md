# @citestyle/types

TypeScript type definitions for the Citestyle ecosystem. Covers CSL-JSON data structures, compiled style modules, the citation registry, and all public APIs.

You get these types automatically when using any `@citestyle/*` package — each package's `exports` map includes a `types` condition that points here. Install this package directly only if you need to import types without pulling in a runtime package.

## Installation

```bash
npm install -D @citestyle/types
```

## Types

### CSL-JSON data

| Type | Description |
|---|---|
| `CslItem` | A citation item with all standard CSL-JSON fields (70+), plus `year-suffix` and an index signature for extended fields |
| `CslName` | Name object: `family`, `given`, `non-dropping-particle`, `dropping-particle`, `suffix`, `literal` |
| `CslDate` | Date object: `date-parts`, `literal`, `raw`, `season`, `circa` |
| `CslItemType` | Union of all 40+ CSL item type strings |

### Compiled style modules

| Type | Description |
|---|---|
| `CompiledStyle` | A compiled style module: `meta`, `bibliography()`, `citation()`, `bibliographySort()` |
| `StyleMeta` | Style metadata: `id`, `title`, `class`, disambiguation settings, collapse mode, delimiters |
| `FormattedEntry` | Bibliography output: `{ text, html, parts, links }` |
| `FormattedCitation` | Citation output: `{ text, html }` |

### Registry

| Type | Description |
|---|---|
| `Registry` | Registry interface: `addItems()`, `getItem()`, `cite()`, `getBibliography()`, `size` |
| `RegistryOptions` | Options for `createRegistry()`: `subsequentAuthorSubstitute` |
| `CiteRef` | A citation reference: `id`, `item`, `locator`, `label`, `prefix`, `suffix` |
| `FormatContext` | Runtime context passed to style functions: `_secOpts`, `_disambig` |
| `DisambiguationContext` | Per-cite disambiguation state: `addNames`, `addGivenname`, `givenname` |

### Compiler

| Type | Description |
|---|---|
| `CompileOptions` | Options for `compile()`: `locale`, `format` |
| `CompileResult` | Compiler output: `{ code, meta }` |

### Formatting helpers

| Type | Description |
|---|---|
| `NameFormatConfig` | Configuration for `formatNames()`: et-al, particles, sort order, initialization |
| `DateFormatConfig` | Configuration for `formatDate()`: date parts, month terms, ranges |
| `ValidationResult` | Output of `validateItem()`: `{ valid, warnings }` |

## Usage

```typescript
import type { CslItem, CslName, FormattedEntry, CompiledStyle } from '@citestyle/types'

const item: CslItem = {
  id: '1',
  type: 'article-journal',
  title: 'A groundbreaking study',
  author: [{ family: 'Smith', given: 'Jane' }],
  issued: { 'date-parts': [[2024, 6]] },
  'container-title': 'Nature',
  DOI: '10.1038/example',
}

function formatBibliography(style: CompiledStyle, items: CslItem[]): FormattedEntry[] {
  return items.map(item => style.bibliography!(item))
}
```

```typescript
import type { Registry, CiteRef, FormattedCitation } from '@citestyle/types'

function citeItems(registry: Registry, ids: string[]): FormattedCitation {
  const cites: CiteRef[] = ids.map(id => ({ id }))
  return registry.cite(cites)
}
```
