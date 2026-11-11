# @citestyle/core

Shared runtime library for the Citestyle ecosystem. Every compiled CSL style imports from this package — it provides the formatting functions that styles call at runtime (name formatting, date formatting, text-case transforms, number formatting, page ranges, and HTML output).

**You probably don't need to install this directly.** It's automatically pulled in as a dependency of compiled styles and `@citestyle/registry`. This documentation is for contributors, advanced use cases, and anyone curious about what's under the hood.

## Installation

```bash
npm install @citestyle/core
```

~6-8KB. Zero dependencies. Works in Node.js and browsers.

## What it does

When the Citestyle compiler transforms a `.csl` file into JavaScript, the generated code calls functions from this package instead of inlining the logic. This keeps each compiled style small (~3-5KB) while sharing the heavier formatting logic (~6-8KB) across all styles.

For example, a compiled APA style might generate:

```javascript
// Generated code in apa.js — calls into @citestyle/core
import { formatNames, formatDate, applyTextCase, toHtml } from '@citestyle/core'

// The style bakes in the *configuration*, core provides the *implementation*
formatNames(item.author, { and: 'symbol', initializeWith: '. ', nameAsSortOrder: 'first' })
```

## API

### Name formatting

#### `formatNames(names, config?)`

Format CSL name objects according to style-specific rules. Handles et-al truncation, particles (von, de la), sort order, initialization, and all five CSL `disambiguate-add-givenname` rules.

```javascript
import { formatNames } from '@citestyle/core'

formatNames(
  [{ family: 'Smith', given: 'John' }, { family: 'Doe', given: 'Jane' }],
  { and: 'text', delimiter: ', ', initializeWith: '. ' }
)
// → "J. Smith and J. Doe"

formatNames(
  [{ family: 'de la Cruz', given: 'Maria', 'non-dropping-particle': 'de la' }],
  { nameAsSortOrder: 'all', sortSeparator: ', ' }
)
// → "de la Cruz, Maria"
```

**Config options**: `and`, `delimiter`, `delimiterPrecedesLast`, `etAlMin`, `etAlUseFirst`, `etAlUseLast`, `initialize`, `initializeWith`, `nameAsSortOrder`, `sortSeparator`, `nameParts`, `form`.

### Date formatting

#### `formatDate(date, config?)`

Format CSL date objects with configurable parts, localized month terms, ranges, and seasons.

```javascript
import { formatDate } from '@citestyle/core'

formatDate(
  { 'date-parts': [[2024, 3, 15]] },
  { dateParts: [{ name: 'year' }, { name: 'month', form: 'long', prefix: ', ' }, { name: 'day', prefix: ' ' }] }
)
// → "2024, March 15"
```

### Text-case transforms

All transforms respect `<span class="nocase">` protection in CSL-JSON values — brand names like "iPhone" and chemical terms like "pH" are preserved.

#### `applyTextCase(str, textCase)`

Unified entry point for all CSL text-case values.

```javascript
import { applyTextCase } from '@citestyle/core'

applyTextCase('the art of war', 'title')              // "The Art of War"
applyTextCase('A STUDY OF DNA', 'sentence')            // "A study of DNA"
applyTextCase('proceedings of the IEEE', 'title')      // "Proceedings of the IEEE"
applyTextCase('<span class="nocase">iPhone</span> sales', 'uppercase')
                                                       // "IPHONE SALES" → no: "iPhone SALES"
```

**Supported values**: `'lowercase'`, `'uppercase'`, `'capitalize-first'`, `'capitalize-all'`, `'title'`, `'sentence'`.

#### Individual transforms

- **`titleCase(str)`** — Title case with stop-word handling. Preserves acronyms and nocase spans.
- **`sentenceCase(str)`** — Lowercase all but first word. Preserves all-caps acronyms (DNA, USA) in mixed-case input.
- **`capitalize(str)`** — Capitalize the first character.
- **`stripNocaseSpans(str)`** — Remove `<span class="nocase">` tags without changing case. Used when a value passes through without any text-case transform.

### Number formatting

```javascript
import { ordinal, longOrdinal, roman } from '@citestyle/core'

ordinal(3)       // "3rd"
longOrdinal(2)   // "second"
roman(14)        // "xiv"
```

For ordinals in another language, with the gender of the noun they count, see `formatOrdinal` under [Locales](#locales).

### Page ranges

#### `pageRange(pages, format?, delimiter?)`

Format page ranges per CSL `page-range-format` rules. `delimiter` is the locale's `page-range-delimiter` term (an en-dash by default; French uses a non-breaking hyphen).

```javascript
import { pageRange } from '@citestyle/core'

pageRange('321-328', 'chicago')  // "321–28"   (en-dash, Chicago-style abbreviation)
pageRange('321-328', 'minimal')  // "321–8"    (en-dash, minimal abbreviation)
pageRange('321-328', 'expanded') // "321–328"  (en-dash, no abbreviation)
```

### Locales

Compiled styles read every locale-dependent value — terms, ordinals, month names, date formats, quotation marks, punctuation-in-quote — from a resolved locale at format time. These helpers build and read one. You need them only to write a formatter of your own: a compiled style calls them itself when it is given a pack from [`@citestyle/locales`](../locales).

- **`localize(pack, base, own?)`** — Resolve a locale pack with CSL 1.0.2's locale fallback: `base` (the en-US data a style carries), then the pack, then the style's own `<locale>` layers by `xml:lang` (`''`, the language, the dialect). Returns `null`, with a console warning the first time, for a pack whose `version` isn't `LOCALE_FORMAT`.
- **`getTerm(locale, key, plural?)`** — A term's text: `getTerm(fr, 'editor:short', true)`. A form the locale lacks falls back as CSL says (verb-short → verb → long, symbol → short → long).
- **`formatOrdinal(locale, n, noun?, long?)`** — `"2nd"`, `"2ᵉ"`, `"2."`, or a long ordinal, in the gender of `noun` (`'edition'` is feminine in French: `"1ʳᵉ"`).
- **`dayOrdinal(locale, day, month?)`** — A day as an ordinal, with the month's gender and `limit-day-ordinals-to-day-1` (French `"1ᵉʳ"`, `"2"`).
- **`dateConfig(locale, spec)`** — The `formatDate` configuration for one of a style's `<date>` elements: a localized date takes the locale's format.
- **`mergeLayers(lower, upper)`** — Merge two locale layers with CSL's rules: a term form is replaced on its own, with its gender; any ordinal suffix term replaces them all.
- **`LOCALE_FORMAT`** — The pack format version these read: `1`.

### HTML output

#### `toHtml(str)`

Convert internal formatting tokens to semantic HTML. Also auto-links DOIs and URLs. This is the final output step — call it on the raw output from a compiled style function.

#### `stripFormatting(str)`

Remove all formatting tokens for clean plain text output.

#### `escapeHtml(str)`

Escape `&`, `<`, `>`, `"`, `'` for safe HTML interpolation. Used internally by compiled styles for all variable output.

### Validation

#### `validateItem(item)`

Validate a CSL-JSON item and return warnings for common mistakes.

```javascript
import { validateItem } from '@citestyle/core'

validateItem({ id: '1', type: 'article-journal', title: 'My Paper', doi: '10.1234/x' })
// { valid: true, warnings: ['Use uppercase "DOI" instead of "doi"'] }

validateItem({ title: 'Missing required fields' })
// { valid: false, warnings: ['Missing required field: id', 'Missing required field: type'] }
```

Checks for: missing `id`/`type`, invalid type values, malformed name fields (should be arrays of objects with `family` or `literal`), malformed date fields, and common field-name mistakes (`doi` → `DOI`, `url` → `URL`, `isbn` → `ISBN`).
