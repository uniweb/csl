/**
 * A style's default locale, at compile time.
 *
 * The compiler resolves nothing from it: it inlines the default locale's data, from the CSL locale
 * files (see ./locale-data.js), as a pack of the style's own, and the compiled style resolves it at
 * format time exactly as it resolves a locale pack passed as `locale` (core's `localize`).
 */
import { localeData } from './locale-data.js'

/**
 * The default locale's data, for generate(): the CSL locale file for `lang` over its language's
 * primary dialect, as localeData() assembles it. A style's own <locale> elements are not merged in
 * here: the compiled style applies them over its default, as over any pack.
 *
 * @param {string} [lang='en-US']
 * @returns {{ lang: string, layer: object, sources: Array<{ file: string, info: object }> }}
 */
export function resolveLocale(lang = 'en-US') {
  const { layer, sources } = localeData(lang)
  return { lang: layer.lang, layer, sources }
}
