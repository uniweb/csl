# @citestyle/types

TypeScript type definitions for the Citestyle ecosystem. Provides interfaces for CSL-JSON data, compiled style modules, and the citation registry.

## Installation

```bash
npm install @citestyle/types
```

Types are ambient -- each `@citestyle/*` package references this package via the `"types"` field in its `package.json`, so consumers get type checking automatically.

## Key Types

### CSL-JSON Input

| Type | Description |
|---|---|
| `CslItem` | A citation item with all standard CSL-JSON fields |
| `CslName` | Name object: `family`, `given`, particles, `literal` |
| `CslDate` | Date object: `date-parts`, `literal`, `season`, `circa` |
| `CslItemType` | Union of all 40+ CSL item types |

### Compiled Style Output

| Type | Description |
|---|---|
| `FormattedEntry` | Bibliography entry: `{ text, html, parts, links }` |
| `FormattedCitation` | Inline citation: `{ text, html }` |
| `CompiledStyle` | Module interface: `meta`, `bibliography()`, `citation()`, `bibliographySort()` |
| `StyleMeta` | Style metadata: `id`, `title`, `class`, disambiguation settings, collapse mode |

### Registry

| Type | Description |
|---|---|
| `Registry` | Registry interface: `addItems()`, `getItem()`, `cite()`, `getBibliography()`, `size` |
| `RegistryOptions` | Options for `createRegistry()` |
| `CiteRef` | Citation reference within a `cite()` call: `id`, `locator`, `label`, `prefix`, `suffix` |
| `FormatContext` | Runtime context passed to style functions |

### Compiler

| Type | Description |
|---|---|
| `CompileOptions` | Options for `compile()`: `locale`, `format` |
| `CompileResult` | Compiler output: `code`, `meta` |

## Usage

```ts
import type { CslItem, CslName, FormattedEntry, CompiledStyle } from '@citestyle/types'

const author: CslName = {
  family: 'Smith',
  given: 'Jane',
}

const item: CslItem = {
  id: '1',
  type: 'article-journal',
  title: 'A groundbreaking study',
  author: [author],
  issued: { 'date-parts': [[2024, 6]] },
  'container-title': 'Nature',
  DOI: '10.1038/example',
}

// Compiled styles conform to CompiledStyle
function formatBibliography(style: CompiledStyle, items: CslItem[]): FormattedEntry[] {
  return items.map(item => style.bibliography!(item))
}
```

### With the registry

```ts
import type { Registry, CiteRef, FormattedCitation } from '@citestyle/types'

function citeItems(registry: Registry, ids: string[]): FormattedCitation {
  const cites: CiteRef[] = ids.map(id => ({ id }))
  return registry.cite(cites)
}
```
