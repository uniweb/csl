import type { CompiledStyle } from '@citestyle/types'

declare const style: CompiledStyle
export default style
export declare const meta: CompiledStyle['meta']
export declare function bibliography(item: import('@citestyle/types').CslItem, ctx?: import('@citestyle/types').FormatContext): import('@citestyle/types').FormattedEntry
export declare function citation(cites: import('@citestyle/types').CiteRef[], ctx?: import('@citestyle/types').FormatContext): import('@citestyle/types').FormattedCitation
export declare function bibliographySort(a: import('@citestyle/types').CslItem, b: import('@citestyle/types').CslItem): number
