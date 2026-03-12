/**
 * Compile a CSL XML string into a JavaScript module string.
 *
 * Pipeline: XML → parse → resolve locale → codegen → JS module
 *
 * @param {string} cslXml - CSL XML source
 * @param {object} [options]
 * @param {string} [options.locale='en-US'] - Target locale
 * @param {string} [options.format='esm'] - Output format ('esm' | 'cjs')
 * @returns {{ code: string, meta: object }}
 */
import { parse } from './parser.js'
import { resolveLocale } from './locale.js'
import { generate } from './codegen.js'

export function compile(cslXml, options = {}) {
  const { locale = 'en-US' } = options

  // 1. Parse CSL XML → AST
  const ast = parse(cslXml)

  // 2. Resolve locale: style overrides → locale file → en-US fallback
  const targetLocale = ast.defaultLocale || locale
  const resolvedLocale = resolveLocale(targetLocale, ast.localeOverrides)

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
