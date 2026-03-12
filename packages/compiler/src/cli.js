#!/usr/bin/env node

/**
 * CLI entry point for the CSL compiler.
 *
 * Usage:
 *   citestyle compile <input.csl> -o <output.js>
 *   citestyle compile <input.csl> --locale en-US -o <output.js>
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { compile } from './compile.js'

const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: citestyle compile <input.csl> [options]

Options:
  -o, --output <file>    Output file path (default: stdout)
  --locale <lang>        Target locale (default: style's default or en-US)
  --help                 Show this help message

Examples:
  citestyle compile apa.csl -o apa.js
  citestyle compile apa.csl --locale fr-FR -o apa-fr.js`)
  process.exit(0)
}

const command = args[0]
if (command !== 'compile') {
  console.error(`Unknown command: ${command}. Use "citestyle compile <file>".`)
  process.exit(1)
}

const inputFile = args[1]
if (!inputFile) {
  console.error('Error: No input file specified.')
  process.exit(1)
}

// Parse options
let outputFile = null
let locale = undefined

for (let i = 2; i < args.length; i++) {
  if (args[i] === '-o' || args[i] === '--output') {
    outputFile = args[++i]
  } else if (args[i] === '--locale') {
    locale = args[++i]
  }
}

try {
  const cslXml = readFileSync(inputFile, 'utf-8')
  const options = {}
  if (locale) options.locale = locale

  const { code, meta } = compile(cslXml, options)

  if (outputFile) {
    writeFileSync(outputFile, code)
    console.log(`Compiled ${meta.title} → ${outputFile} (${(code.length / 1024).toFixed(1)}KB)`)
  } else {
    process.stdout.write(code)
  }
} catch (err) {
  console.error(`Error compiling ${inputFile}: ${err.message}`)
  process.exit(1)
}
