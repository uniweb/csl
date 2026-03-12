import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPath = join(__dirname, '..', 'src', 'cli.js')
const fixturesDir = join(__dirname, '..', '..', '..', 'test', 'fixtures')
const tmpDir = join(__dirname, '.tmp-cli')

function run(...args) {
  return execFileSync('node', [cliPath, ...args], {
    encoding: 'utf-8',
    timeout: 10000,
  })
}

function runStatus(...args) {
  try {
    const stdout = execFileSync('node', [cliPath, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
    })
    return { stdout, code: 0 }
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status }
  }
}

// Find a .csl fixture file
const apaPath = join(fixturesDir, 'apa.csl')
const hasApa = existsSync(apaPath)

describe('CLI', () => {
  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(() => {
    try { rmSync(tmpDir, { recursive: true }) } catch {}
  })

  it('shows help with --help', () => {
    const output = run('--help')
    expect(output).toContain('citestyle')
    expect(output).toContain('compile')
    expect(output).toContain('check')
  })

  it('shows help with no args', () => {
    const output = run()
    expect(output).toContain('compile')
  })

  it('errors on unknown command', () => {
    const { stderr, code } = runStatus('foobar')
    expect(code).not.toBe(0)
    expect(stderr).toContain('Unknown command')
  })

  if (hasApa) {
    it('compiles a CSL file to stdout', () => {
      const output = run('compile', apaPath)
      expect(output).toContain('function bibliography')
      expect(output).toContain('@citestyle/core')
    })

    it('compiles to output file', () => {
      const outFile = join(tmpDir, 'apa-test.js')
      const output = run('compile', apaPath, '-o', outFile)
      expect(output).toContain('→')
      const code = readFileSync(outFile, 'utf-8')
      expect(code).toContain('export function bibliography')
    })

    it('compiles with --format cjs', () => {
      const outFile = join(tmpDir, 'apa-cjs.cjs')
      run('compile', apaPath, '--format', 'cjs', '-o', outFile)
      const code = readFileSync(outFile, 'utf-8')
      expect(code).toContain('require(')
      expect(code).toContain('module.exports')
      expect(code).not.toContain('import {')
    })

    it('checks a valid CSL file', () => {
      const output = run('check', apaPath)
      expect(output).toContain('✓')
    })

    it('compiles batch to output directory', () => {
      const batchDir = join(tmpDir, 'batch')
      run('compile', apaPath, '-o', batchDir + '/')
      const files = require('node:fs').readdirSync(batchDir)
      expect(files.length).toBeGreaterThanOrEqual(1)
      expect(files.some(f => f.endsWith('.js'))).toBe(true)
    })
  }

  it('check errors on non-existent file', () => {
    const { code } = runStatus('check', '/tmp/does-not-exist.csl')
    expect(code).not.toBe(0)
  })

  it('compile errors on non-existent file', () => {
    const { code } = runStatus('compile', '/tmp/does-not-exist.csl')
    expect(code).not.toBe(0)
  })

  it('check validates malformed CSL', () => {
    const badCsl = join(tmpDir, 'bad.csl')
    writeFileSync(badCsl, '<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0"><info><id/><title/><updated>2024-01-01</updated></info></style>')
    const output = run('check', badCsl)
    expect(output).toContain('⚠')
    expect(output).toContain('warning')
  })
})
