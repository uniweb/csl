/**
 * @citestyle/types
 *
 * TypeScript type definitions for the CSL compiler ecosystem.
 */

// ---------------------------------------------------------------------------
// CSL-JSON types (input to compiled styles)
// ---------------------------------------------------------------------------

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

export interface CslName {
  family?: string
  given?: string
  suffix?: string
  'non-dropping-particle'?: string
  'dropping-particle'?: string
  literal?: string
}

export interface CslDate {
  'date-parts'?: number[][]
  literal?: string
  raw?: string
  season?: number
  circa?: boolean
}

export interface CslItem {
  id: string
  type: CslItemType

  // Names
  author?: CslName[]
  editor?: CslName[]
  translator?: CslName[]
  'container-author'?: CslName[]
  'collection-editor'?: CslName[]

  // Titles
  title?: string
  'title-short'?: string
  'container-title'?: string
  'container-title-short'?: string
  'collection-title'?: string

  // Dates
  issued?: CslDate
  accessed?: CslDate
  'original-date'?: CslDate

  // Numbers
  volume?: string | number
  issue?: string | number
  page?: string
  'page-first'?: string
  edition?: string | number
  'chapter-number'?: string | number
  'number-of-pages'?: string | number
  'number-of-volumes'?: string | number

  // Identifiers
  DOI?: string
  URL?: string
  ISBN?: string
  ISSN?: string
  PMID?: string
  PMCID?: string

  // Other
  publisher?: string
  'publisher-place'?: string
  abstract?: string
  language?: string
  genre?: string
  source?: string
  note?: string
  annote?: string
  keyword?: string
  'citation-number'?: string | number
  'citation-label'?: string

  // Extended metadata (web artifacts — ignored by compiled CSL styles,
  // consumed by web display styles)
  extended?: WebScholarMetadata
}

// ---------------------------------------------------------------------------
// Extended metadata for web display
// ---------------------------------------------------------------------------

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

export interface FormattedCitation {
  html: string
  text: string
}

export interface FormatContext {
  /** Position in bibliography (for numbering) */
  position?: number
  /** Whether disambiguation is active */
  disambiguate?: boolean
  /** Year suffix assigned by registry ('a', 'b', ...) */
  yearSuffix?: string
  /** Locale override */
  locale?: string
}

// ---------------------------------------------------------------------------
// Compiled style module interface
// ---------------------------------------------------------------------------

export interface StyleMeta {
  id: string
  title: string
  class: 'in-text' | 'note'
  categories?: string[]
  locales?: string[]
  version?: string
  compiledWith?: string
}

export interface CompiledStyle {
  meta: StyleMeta
  bibliography: (item: CslItem, ctx: FormatContext) => FormattedEntry
  citation: (cites: CiteRef[], ctx: FormatContext) => FormattedCitation
  bibliographySort?: (a: CslItem, b: CslItem) => number
}

export interface CiteRef {
  id: string
  item?: CslItem
  locator?: string
  label?: string
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export interface Registry {
  addItems(items: CslItem[]): void
  cite(cites: CiteRef[]): FormattedCitation
  getBibliography(): FormattedEntry[]
}
