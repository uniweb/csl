/**
 * @citestyle/types
 *
 * TypeScript type definitions for the CSL compiler ecosystem.
 */

// ---------------------------------------------------------------------------
// CSL-JSON types (input to compiled styles)
// ---------------------------------------------------------------------------

/** All CSL 1.0.2 item types */
export type CslItemType =
  | 'article'
  | 'article-journal'
  | 'article-magazine'
  | 'article-newspaper'
  | 'bill'
  | 'book'
  | 'broadcast'
  | 'chapter'
  | 'dataset'
  | 'entry'
  | 'entry-dictionary'
  | 'entry-encyclopedia'
  | 'figure'
  | 'graphic'
  | 'interview'
  | 'legal_case'
  | 'legislation'
  | 'manuscript'
  | 'map'
  | 'motion_picture'
  | 'musical_score'
  | 'pamphlet'
  | 'paper-conference'
  | 'patent'
  | 'personal_communication'
  | 'post'
  | 'post-weblog'
  | 'regulation'
  | 'report'
  | 'review'
  | 'review-book'
  | 'software'
  | 'song'
  | 'speech'
  | 'standard'
  | 'thesis'
  | 'treaty'
  | 'webpage'

/** CSL name object */
export interface CslName {
  family?: string
  given?: string
  suffix?: string
  'non-dropping-particle'?: string
  'dropping-particle'?: string
  /** Corporate/institutional author (used as-is, not parsed into family/given) */
  literal?: string
}

/** CSL date object */
export interface CslDate {
  /** Array of [year, month?, day?] arrays. Two elements for date ranges. */
  'date-parts'?: number[][]
  /** Literal date string (used as-is, not parsed) */
  literal?: string
  /** Raw date string for parsing */
  raw?: string
  /** Season number (1=spring, 2=summer, 3=fall, 4=winter) */
  season?: number
  /** Approximate date flag */
  circa?: boolean
}

/** CSL-JSON item — the standard input format for citation formatting */
export interface CslItem {
  id: string | number
  type: CslItemType

  // Names
  author?: CslName[]
  editor?: CslName[]
  translator?: CslName[]
  'container-author'?: CslName[]
  'collection-editor'?: CslName[]
  composer?: CslName[]
  director?: CslName[]
  interviewer?: CslName[]
  'reviewed-author'?: CslName[]
  recipient?: CslName[]
  illustrator?: CslName[]
  'original-author'?: CslName[]

  // Titles
  title?: string
  'title-short'?: string
  'container-title'?: string
  'container-title-short'?: string
  'collection-title'?: string
  'original-title'?: string

  // Dates
  issued?: CslDate
  accessed?: CslDate
  'original-date'?: CslDate
  submitted?: CslDate
  'event-date'?: CslDate

  // Numbers
  volume?: string | number
  issue?: string | number
  page?: string
  'page-first'?: string
  edition?: string | number
  'chapter-number'?: string | number
  'number-of-pages'?: string | number
  'number-of-volumes'?: string | number
  number?: string | number

  // Identifiers
  DOI?: string
  URL?: string
  ISBN?: string
  ISSN?: string
  PMID?: string
  PMCID?: string

  // Other standard fields
  publisher?: string
  'publisher-place'?: string
  abstract?: string
  language?: string
  genre?: string
  source?: string
  note?: string
  annote?: string
  keyword?: string
  'event-place'?: string
  'event-title'?: string
  'call-number'?: string
  archive?: string
  'archive-place'?: string
  'archive_location'?: string
  dimensions?: string
  medium?: string
  scale?: string
  section?: string
  status?: string
  version?: string
  'year-suffix'?: string

  // Registry-assigned fields
  'citation-number'?: string | number
  'citation-label'?: string
  'first-reference-note-number'?: string | number

  // Extended metadata (web artifacts — ignored by compiled CSL styles,
  // consumed by web display styles)
  extended?: WebScholarMetadata

  // Allow additional properties for forward compatibility
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Extended metadata for web display
// ---------------------------------------------------------------------------

/** Extended metadata for modern web scholarship artifacts */
export interface WebScholarMetadata {
  pdf_url?: string
  code_url?: string
  data_url?: string
  slides_url?: string
  video_url?: string
  preprint_url?: string
  demo_url?: string
  poster_url?: string
  open_access?: boolean | 'gold' | 'green' | 'bronze'
  awards?: string[]
  affiliations?: Record<string, string>
  citation_count?: number
  altmetric_score?: number
}

// ---------------------------------------------------------------------------
// Compiled style output
// ---------------------------------------------------------------------------

/** Formatted bibliography entry — the structured output from a compiled style */
export interface FormattedEntry {
  /** Semantic HTML with CSS classes and clickable links */
  html: string
  /** Decomposed fields for custom rendering (cards, profiles) */
  parts: Record<string, unknown>
  /** Extracted links (DOI, URL, PDF, etc.) */
  links: Record<string, string | null>
  /** Plain text fallback for copy-paste and accessibility */
  text: string
}

/** Formatted inline citation */
export interface FormattedCitation {
  html: string
  text: string
}

/** Runtime format context passed to compiled style functions */
export interface FormatContext {
  /** Section-level name options override (set by registry for citation vs bibliography) */
  _secOpts?: Record<string, unknown>
  /** Per-cite disambiguation context (set by registry) */
  _disambig?: DisambiguationContext
  /** Allow additional context properties */
  [key: string]: unknown
}

/** Per-cite disambiguation context (internal, set by registry) */
export interface DisambiguationContext {
  /** Name indices to expand given names for */
  expandIndices?: number[]
  /** Expand all name given names */
  expandAll?: boolean
  /** Use initials instead of full given names when expanding */
  withInitials?: boolean
  /** Override et-al-use-first count */
  etAlUseFirst?: number
  /** Override et-al-min count */
  etAlMin?: number
}

// ---------------------------------------------------------------------------
// Compiled style module interface
// ---------------------------------------------------------------------------

/** Style metadata exported by compiled styles */
export interface StyleMeta {
  id: string
  title: string
  class: 'in-text' | 'note'
  version?: string
  compiledWith?: string

  // Registry-consumed settings (conditionally present based on the CSL style)
  /** Subsequent author substitute string (e.g. "———") */
  subsequentAuthorSubstitute?: string
  /** Whether the style uses year-suffix disambiguation (a, b, c) */
  disambiguateAddYearSuffix?: boolean
  /** Whether the style uses add-names disambiguation */
  disambiguateAddNames?: boolean
  /** Whether the style uses givenname disambiguation */
  disambiguateAddGivenname?: boolean
  /** Givenname disambiguation rule */
  givennameDisambiguationRule?: 'by-cite' | 'all-names' | 'all-names-with-initials' | 'primary-name' | 'primary-name-with-initials'
  /** Cite collapsing mode */
  collapse?: 'citation-number' | 'year' | 'year-suffix' | 'year-suffix-ranged'
  /** Citation layout delimiter (used in collapsed output) */
  citationLayoutDelimiter?: string
  /** Citation layout prefix (used in collapsed output reconstruction) */
  citationLayoutPrefix?: string
  /** Citation layout suffix (used in collapsed output reconstruction) */
  citationLayoutSuffix?: string
  /** Cite group delimiter for collapsed author-date citations */
  citeGroupDelimiter?: string
  /** Year-suffix delimiter for collapsed year-suffix citations */
  yearSuffixDelimiter?: string
  /** Delimiter after collapsed group */
  afterCollapseDelimiter?: string
}

/** A compiled CSL style module */
export interface CompiledStyle {
  meta: StyleMeta
  /** Format a single bibliography entry */
  bibliography?: (item: CslItem, ctx?: FormatContext) => FormattedEntry
  /** Format an inline citation cluster */
  citation?: (cites: CiteRef[], ctx?: FormatContext) => FormattedCitation
  /** Sort comparator for bibliography ordering */
  bibliographySort?: (a: CslItem, b: CslItem) => number
}

/** A citation reference within a cite() call */
export interface CiteRef {
  /** Item ID (resolved from registry) */
  id: string
  /** Pre-resolved item (bypasses registry lookup) */
  item?: CslItem
  /** Locator value (e.g. page number) */
  locator?: string
  /** Locator label (e.g. 'page', 'chapter', 'paragraph') */
  label?: string
  /** Citation prefix text */
  prefix?: string
  /** Citation suffix text */
  suffix?: string
  /** Internal: disambiguation context (set by registry) */
  _disambig?: DisambiguationContext
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Registry options */
export interface RegistryOptions {
  /** Override the style's subsequent-author-substitute string */
  subsequentAuthorSubstitute?: string
}

/** Citation registry — manages cross-citation state */
export interface Registry {
  /** Add items to the registry */
  addItems(items: CslItem[]): void
  /** Look up an item by ID */
  getItem(id: string): CslItem | undefined
  /** Format a citation cluster */
  cite(cites: CiteRef[], ctx?: FormatContext): FormattedCitation
  /** Get the formatted bibliography in sort order */
  getBibliography(ctx?: FormatContext): FormattedEntry[]
  /** Number of items in the registry */
  readonly size: number
}

/** Create a citation registry for a compiled style */
export declare function createRegistry(style: CompiledStyle, options?: RegistryOptions): Registry

/** Format a single bibliography entry (no registry needed) */
export declare function format(style: CompiledStyle, item: CslItem, ctx?: FormatContext): FormattedEntry

/** Format multiple bibliography entries with basic sorting (no registry needed) */
export declare function formatAll(style: CompiledStyle, items: CslItem[], ctx?: FormatContext): FormattedEntry[]

/** Format a single inline citation (no registry needed) */
export declare function formatCitation(style: CompiledStyle, cites: CiteRef[], ctx?: FormatContext): FormattedCitation

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

/** Compiler options */
export interface CompileOptions {
  /** Target locale (default: style's default or 'en-US') */
  locale?: string
  /** Output format (default: 'esm') */
  format?: 'esm' | 'cjs'
}

/** Compiler result */
export interface CompileResult {
  /** Generated JavaScript module source code */
  code: string
  /** Style metadata extracted during compilation */
  meta: {
    id: string
    title: string
    class: 'in-text' | 'note'
    version?: string
    defaultLocale?: string
  }
}

/** Compile a CSL XML string into a JavaScript module */
export declare function compile(cslXml: string, options?: CompileOptions): CompileResult

/** Parse a CSL XML string into an AST (for validation/inspection) */
export declare function parse(cslXml: string): unknown

/** Resolve locale data for a target locale with optional style overrides */
export declare function resolveLocale(locale: string, overrides?: unknown): unknown

/** Generate JavaScript module source from a CSL AST */
export declare function generate(ast: unknown, locale: unknown, options?: CompileOptions): string

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Format a list of names according to CSL name options */
export declare function formatNames(names: CslName[], config?: NameFormatConfig): string

/** Name formatting configuration (baked in by compiler, resolved at runtime) */
export interface NameFormatConfig {
  and?: 'text' | 'symbol'
  delimiter?: string
  delimiterPrecedesLast?: 'contextual' | 'always' | 'never' | 'after-inverted-name'
  delimiterPrecedesEtAl?: 'contextual' | 'always' | 'never' | 'after-inverted-name'
  etAlMin?: number
  etAlUseFirst?: number
  etAlUseLast?: boolean
  initialize?: boolean
  initializeWith?: string
  nameAsSortOrder?: 'first' | 'all'
  sortSeparator?: string
  andTerm?: string
  etAlTerm?: string
  nameParts?: Array<{ name: string; textCase?: string; fontStyle?: string; fontWeight?: string }>
  _disambig?: DisambiguationContext
}

/** Format a date according to CSL date configuration */
export declare function formatDate(date: CslDate, config?: DateFormatConfig): string

/** Date formatting configuration */
export interface DateFormatConfig {
  dateParts?: Array<{
    name: string
    form?: string
    prefix?: string
    suffix?: string
    rangeDelimiter?: string
  }>
  monthTerms?: Record<string, string>
  seasonTerms?: Record<string, string>
}

/** Apply text-case transform with nocase span protection */
export declare function applyTextCase(str: string, textCase: string): string

/** Title-case a string (nocase-aware) */
export declare function titleCase(str: string): string

/** Sentence-case a string (nocase-aware, preserves acronyms) */
export declare function sentenceCase(str: string): string

/** Capitalize first letter */
export declare function capitalize(str: string): string

/** Strip `<span class="nocase">` tags without case transform */
export declare function stripNocaseSpans(str: string): string

/** Format a number as an ordinal (1st, 2nd, etc.) */
export declare function ordinal(n: number, config?: { locale?: string; gender?: string; form?: string }): string

/** Format a number as a long ordinal (first, second, etc.) */
export declare function longOrdinal(n: number, config?: Record<string, unknown>): string

/** Format a number as a Roman numeral */
export declare function roman(n: number): string

/** Format a page range according to CSL page-range-format */
export declare function pageRange(pages: string, format?: string): string

/** Escape HTML special characters */
export declare function escapeHtml(str: string): string

/** Strip PUA formatting tokens from a string, returning plain text */
export declare function stripFormatting(str: string): string

/** Convert PUA formatting tokens to HTML tags, with auto-linking */
export declare function toHtml(str: string): string

/** Validation result from validateItem() */
export interface ValidationResult {
  valid: boolean
  warnings: string[]
}

/** Validate a CSL-JSON item for required fields and correct shapes */
export declare function validateItem(item: unknown): ValidationResult

// ---------------------------------------------------------------------------
// BibTeX I/O
// ---------------------------------------------------------------------------

/** Parse a BibTeX string into CSL-JSON items */
export declare function parseBibtex(bibtex: string): CslItem[]

/** Convert LaTeX accent/command sequences to Unicode */
export declare function convertLatex(str: string): string

/** Serialize CSL-JSON items to a BibTeX string */
export declare function exportBibtex(items: CslItem[]): string

// ---------------------------------------------------------------------------
// RIS I/O
// ---------------------------------------------------------------------------

/** Parse a RIS string into CSL-JSON items */
export declare function parseRis(ris: string): CslItem[]

/** Serialize CSL-JSON items to a RIS string */
export declare function exportRis(items: CslItem[]): string
