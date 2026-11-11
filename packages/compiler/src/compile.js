/**
 * Compile a CSL XML string into a JavaScript module string.
 *
 * Pipeline: XML → parse → the default locale's data → codegen → JS module
 *
 * @param {string} cslXml - CSL XML source
 * @param {object} [options]
 * @param {string} [options.locale] - Target locale; the style's default-locale (else en-US) when absent
 * @param {string} [options.format='esm'] - Output format ('esm' | 'cjs')
 * @returns {{ code: string, meta: object }}
 */
import { parse } from './parser.js'
import { resolveLocale } from './locale.js'
import { generate } from './codegen.js'

export function compile(cslXml, options = {}) {
  // 1. Parse CSL XML → AST
  const ast = parse(cslXml)

  // 2. The default locale's data: a locale asked for wins; the style's default-locale is for when
  // none is (the parser reads en-US where a style names none). The compiled style resolves it with
  // the style's own <locale> elements at format time, as it resolves any pack.
  // ⛔ The style's default used to win always, so `--locale fr-FR` compiled English for every
  // style, and a style naming no default could not be rendered in its own en-GB block.
  const targetLocale = options.locale || ast.defaultLocale || 'en-US'
  const resolvedLocale = resolveLocale(targetLocale)

  // 3. Merge inheritable name options from the style root into the AST
  //    (the codegen handles this per-section)

  // 4. Generate JavaScript module
  const code = generate(ast, resolvedLocale, options)

  // 5. Build meta for the return value
  const info = ast.info || {}
  const meta = {
    id: (info.id || '').replace(/^.*\//, ''),
    title: info.title || '',
    class: ast.class,
    version: ast.version,
    defaultLocale: targetLocale,
  }

  return { code, meta }
}
