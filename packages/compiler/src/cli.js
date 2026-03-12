#!/usr/bin/env node

/**
 * CLI entry point for the CSL compiler.
 *
 * Commands:
 *   citestyle compile <input.csl> [options]  — Compile CSL to JS module
 *   citestyle check <input.csl>              — Validate CSL without compiling
 *
 * Options:
 *   -o, --output <file|dir>   Output file or directory (default: stdout)
 *   --locale <lang[,lang]>    Target locale(s) (default: style's default or en-US)
 *   --format <esm|cjs>        Output format (default: esm)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, basename, extname, resolve, dirname } from 'node:path'
import { compile } from './compile.js'
import { parse } from './parser.js'

const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  printHelp()
  process.exit(0)
}

const command = args[0]

if (command === 'compile') {
  runCompile(args.slice(1))
} else if (command === 'check') {
  runCheck(args.slice(1))
} else {
  console.error(`Unknown command: ${command}. Use "citestyle compile" or "citestyle check".`)
  process.exit(1)
}

function printHelp() {
  console.log(`Usage: citestyle <command> [options]

Commands:
  compile <input...>    Compile CSL XML to JavaScript module(s)
  check <input...>      Validate CSL XML without compiling

Options (compile):
  -o, --output <path>   Output file (single input) or directory (batch mode)
  --locale <lang>       Target locale, comma-separated for multi-locale (default: en-US)
  --format <esm|cjs>    Output format (default: esm)

Examples:
  citestyle compile apa.csl -o apa.js
  citestyle compile apa.csl --locale fr-FR -o apa-fr.js
  citestyle compile apa.csl --locale en-US,fr-FR -o dist/
  citestyle compile styles/*.csl -o dist/
  citestyle compile apa.csl --format cjs -o apa.cjs
  citestyle check apa.csl
  citestyle check styles/*.csl`)
}

// ── Compile command ─────────────────────────────────────────────────────────

function runCompile(args) {
  const { inputs, output, locales, format } = parseArgs(args)

  if (inputs.length === 0) {
    console.error('Error: No input file(s) specified.')
    process.exit(1)
  }

  // Resolve input files (handle globs already expanded by shell)
  const files = resolveInputFiles(inputs)

  if (files.length === 0) {
    console.error('Error: No .csl files found.')
    process.exit(1)
  }

  const isBatch = files.length > 1 || (output && isDirectory(output))
  let exitCode = 0

  for (const file of files) {
    for (const locale of locales) {
      try {
        const cslXml = readFileSync(file, 'utf-8')
        const options = { locale, format }
        const { code, meta } = compile(cslXml, options)

        let finalCode = code
        if (format === 'cjs') {
          finalCode = esmToCjs(code)
        }

        if (output) {
          let outPath
          if (isBatch) {
            mkdirSync(output, { recursive: true })
            let outName = basename(file, extname(file))
            if (locales.length > 1) outName += `-${locale}`
            outName += format === 'cjs' ? '.cjs' : '.js'
            outPath = join(output, outName)
          } else {
            mkdirSync(dirname(resolve(output)), { recursive: true })
            outPath = output
          }

          writeFileSync(outPath, finalCode)
          const size = (finalCode.length / 1024).toFixed(1)
          console.log(`✓ ${meta.title || basename(file)} → ${outPath} (${size}KB)`)
        } else {
          process.stdout.write(finalCode)
        }
      } catch (err) {
        console.error(`✗ ${basename(file)}: ${formatError(err, file)}`)
        exitCode = 1
      }
    }
  }

  if (exitCode) process.exit(exitCode)
}

// ── Check command ───────────────────────────────────────────────────────────

function runCheck(args) {
  const { inputs } = parseArgs(args)

  if (inputs.length === 0) {
    console.error('Error: No input file(s) specified.')
    process.exit(1)
  }

  const files = resolveInputFiles(inputs)

  if (files.length === 0) {
    console.error('Error: No .csl files found.')
    process.exit(1)
  }

  let exitCode = 0

  for (const file of files) {
    try {
      const cslXml = readFileSync(file, 'utf-8')
      const ast = parse(cslXml)

      // Basic validation
      const warnings = validateAst(ast)

      if (warnings.length === 0) {
        console.log(`✓ ${basename(file)}: valid (${ast.info?.title || 'untitled'})`)
      } else {
        console.log(`⚠ ${basename(file)}: ${warnings.length} warning(s)`)
        for (const w of warnings) console.log(`  ${w}`)
      }
    } catch (err) {
      console.error(`✗ ${basename(file)}: ${formatError(err, file)}`)
      exitCode = 1
    }
  }

  if (exitCode) process.exit(exitCode)
}

// ── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(args) {
  const inputs = []
  let output = null
  let localeStr = null
  let format = 'esm'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' || args[i] === '--output') {
      output = args[++i]
    } else if (args[i] === '--locale') {
      localeStr = args[++i]
    } else if (args[i] === '--format') {
      format = args[++i]
      if (format !== 'esm' && format !== 'cjs') {
        console.error(`Error: Unknown format "${format}". Use "esm" or "cjs".`)
        process.exit(1)
      }
    } else if (!args[i].startsWith('-')) {
      inputs.push(args[i])
    }
  }

  const locales = localeStr ? localeStr.split(',').map(s => s.trim()) : ['en-US']

  return { inputs, output, locales, format }
}

function resolveInputFiles(inputs) {
  const files = []
  for (const input of inputs) {
    try {
      const stat = statSync(input)
      if (stat.isDirectory()) {
        const entries = readdirSync(input).filter(f => f.endsWith('.csl')).sort()
        files.push(...entries.map(f => join(input, f)))
      } else {
        files.push(input)
      }
    } catch {
      // Could be a file that doesn't exist
      files.push(input)
    }
  }
  return files
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    // If it doesn't exist and ends with / or has no extension, treat as directory
    return path.endsWith('/') || !extname(path)
  }
}

// ── ESM → CJS conversion ───────────────────────────────────────────────────

function esmToCjs(code) {
  // Convert import statements
  let result = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g,
    (_, imports, source) => {
      const names = imports.split(',').map(s => s.trim()).filter(Boolean)
      return `const { ${names.join(', ')} } = require('${source}')`
    }
  )

  // Convert export function to module.exports
  result = result.replace(
    /export\s+function\s+(\w+)/g,
    'function $1'
  )

  // Convert export const/let
  result = result.replace(
    /export\s+(const|let)\s+(\w+)/g,
    '$1 $2'
  )

  // Add module.exports at the end — find all exported names
  const exportedNames = []
  const origExports = code.matchAll(/export\s+(?:function|const|let)\s+(\w+)/g)
  for (const m of origExports) exportedNames.push(m[1])

  if (exportedNames.length) {
    result += `\nmodule.exports = { ${exportedNames.join(', ')} };\n`
  }

  return result
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateAst(ast, file) {
  const warnings = []

  if (!ast.class) warnings.push('Missing style class (in-text or note)')
  if (!ast.version) warnings.push('Missing CSL version')
  if (!ast.info?.title) warnings.push('Missing <info><title>')
  if (!ast.info?.id) warnings.push('Missing <info><id>')

  if (!ast.bibliography && !ast.citation) {
    warnings.push('No <citation> or <bibliography> element found')
  }

  if (ast.citation && !ast.citation.layout) {
    warnings.push('<citation> has no <layout> child')
  }

  if (ast.bibliography && !ast.bibliography.layout) {
    warnings.push('<bibliography> has no <layout> child')
  }

  // Check for undefined macros (ast.macros is an object keyed by name)
  const definedMacros = new Set(Object.keys(ast.macros || {}))
  const usedMacros = findMacroRefs(ast)
  for (const name of usedMacros) {
    if (!definedMacros.has(name)) {
      warnings.push(`Reference to undefined macro "${name}"`)
    }
  }

  return warnings
}

function findMacroRefs(node, refs = new Set()) {
  if (!node || typeof node !== 'object') return refs
  if (node.type === 'text' && node.macro) refs.add(node.macro)
  if (Array.isArray(node.children)) node.children.forEach(c => findMacroRefs(c, refs))
  if (node.layout) findMacroRefs(node.layout, refs)
  if (node.citation) findMacroRefs(node.citation, refs)
  if (node.bibliography) findMacroRefs(node.bibliography, refs)
  if (node.macros && typeof node.macros === 'object' && !Array.isArray(node.macros)) {
    Object.values(node.macros).forEach(m => findMacroRefs(m, refs))
  }
  if (Array.isArray(node.branches)) node.branches.forEach(b => findMacroRefs(b, refs))
  if (node.else) findMacroRefs(node.else, refs)
  return refs
}

// ── Error formatting ────────────────────────────────────────────────────────

function formatError(err, file) {
  const msg = err.message || String(err)

  // Try to extract line/column info from XML parse errors
  const lineMatch = msg.match(/line[:\s]+(\d+)/i)
  const colMatch = msg.match(/col(?:umn)?[:\s]+(\d+)/i)

  if (lineMatch) {
    const loc = colMatch ? `${lineMatch[1]}:${colMatch[1]}` : lineMatch[1]
    return `${msg} (at ${basename(file)}:${loc})`
  }

  return msg
}
