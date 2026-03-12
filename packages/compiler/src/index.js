/**
 * @citestyle/compiler
 *
 * Build-time compiler that transforms CSL XML files into JavaScript modules.
 *
 * Pipeline: CSL XML → parse → resolve macros/locales → codegen → JS module
 */

export { compile } from './compile.js'
