/**
 * Compile a CSL XML string into a JavaScript module string.
 *
 * @param {string} cslXml - CSL XML source
 * @param {object} [options]
 * @param {string} [options.locale='en-US'] - Target locale
 * @param {string} [options.format='esm'] - Output format ('esm' | 'cjs')
 * @returns {{ code: string, meta: object }}
 */
export function compile(cslXml, options = {}) {
  throw new Error('Not yet implemented')
}
