# @citestyle/core

Shared runtime helpers imported by all compiled CSL styles. Keeps individual style modules small (~3-5KB each) by centralizing formatting logic here (~6-8KB shared).

Most consumers do not need to use this package directly -- compiled styles import from it automatically. This reference is for contributors and advanced use cases.

## Installation

```bash
npm install @citestyle/core
```

## API Reference

### Name Formatting

#### `formatNames(names, config?)`

Format a list of CSL name objects according to CSL name options.

```js
import { formatNames } from '@citestyle/core'

formatNames(
  [{ family: 'Smith', given: 'John' }, { family: 'Doe', given: 'Jane' }],
  { and: 'text', delimiter: ', ', initializeWith: '. ' }
)
// "J. Smith and J. Doe"
```

Config options: `and`, `delimiter`, `delimiterPrecedesLast`, `etAlMin`, `etAlUseFirst`, `etAlUseLast`, `initialize`, `initializeWith`, `nameAsSortOrder`, `sortSeparator`, `nameParts`, `form`.

### Date Formatting

#### `formatDate(date, config?)`

Format a CSL date object with configurable parts, month terms, and range support.

```js
import { formatDate } from '@citestyle/core'

formatDate(
  { 'date-parts': [[2024, 3, 15]] },
  { dateParts: [{ name: 'year' }, { name: 'month', prefix: ', ' }, { name: 'day', prefix: ' ' }] }
)
// "2024, March 15"
```

### Text-Case Transforms

All transforms respect `<span class="nocase">` protection in CSL-JSON values.

#### `applyTextCase(str, textCase)`

Unified entry point for all CSL text-case values: `'lowercase'`, `'uppercase'`, `'capitalize-first'`, `'capitalize-all'`, `'title'`, `'sentence'`.

```js
import { applyTextCase } from '@citestyle/core'

applyTextCase('the art of war', 'title')     // "The Art of War"
applyTextCase('A STUDY OF DNA', 'sentence')  // "A study of DNA"
```

#### `titleCase(str)`

Title-case with stop word handling. Preserves acronyms and intentional casing.

#### `sentenceCase(str)`

Capitalize first word only. Preserves all-caps acronyms (DNA, USA) in mixed-case input.

#### `capitalize(str)`

Capitalize the first character of the string.

#### `stripNocaseSpans(str)`

Remove `<span class="nocase">` tags without applying any case transform.

### Number Formatting

#### `ordinal(n, locale?)`

Format as ordinal: `ordinal(3)` returns `"3rd"`. Supports locale-specific suffixes.

#### `longOrdinal(n, locale?)`

Format as long ordinal: `longOrdinal(2)` returns `"second"`. Falls back to numeric ordinal for n > 10.

#### `roman(n)`

Format as lowercase Roman numeral: `roman(14)` returns `"xiv"`.

### Page Ranges

#### `pageRange(pages, format?)`

Format page ranges per CSL `page-range-format`: `'expanded'`, `'chicago'`, `'minimal'`, `'minimal-two'`.

```js
import { pageRange } from '@citestyle/core'

pageRange('321-328', 'chicago')  // "321\u201328"  (321-28 with en-dash)
pageRange('321-328', 'minimal')  // "321\u20138"   (321-8 with en-dash)
```

### HTML Output

#### `escapeHtml(str)`

Escape `&`, `<`, `>`, `"`, `'` for safe HTML output.

#### `toHtml(str)`

Convert PUA formatting tokens to HTML tags. Also auto-links DOIs and URLs. This is the final output step for HTML rendering.

#### `stripFormatting(str)`

Remove all PUA formatting tokens, returning clean plain text.
