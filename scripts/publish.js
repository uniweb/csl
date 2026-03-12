#!/usr/bin/env node

/**
 * Publish Script for Citestyle Packages
 *
 * Intelligently detects what needs publishing by analyzing:
 * 1. Direct changes: version mismatch, new commits in package directory
 * 2. Dependency alignment: ensures npm packages have consistent deps
 *
 * The script automatically cascades — if @citestyle/core is updated, all
 * packages depending on it will be republished with the new version.
 *
 * Safety features:
 * - Dry run by default (no flags = show what would happen)
 * - Detects if version is already on npm (prevents "already published" errors)
 * - Handles partial publish failures gracefully
 * - Confirmation prompt before actual publish
 *
 * Usage:
 *   node scripts/publish.js                # Dry run - shows what would happen
 *   node scripts/publish.js --publish      # Actually publish (no version bump)
 *   node scripts/publish.js --patch        # Bump patch version and publish
 *   node scripts/publish.js --minor        # Bump minor version and publish
 *   node scripts/publish.js --major        # Bump major version and publish
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Package publish order (dependencies first).
// The order matters: a package must be published before any package that depends on it.
const PACKAGES = [
  { name: '@citestyle/types', path: 'packages/types' },
  { name: '@citestyle/core', path: 'packages/core' },
  { name: '@citestyle/compiler', path: 'packages/compiler' },
  { name: '@citestyle/registry', path: 'packages/registry' },
  { name: '@citestyle/styles', path: 'packages/styles' },
  { name: '@citestyle/bibtex', path: 'packages/bibtex' },
]

// ---------------------------------------------------------------------------
// Terminal colors
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(msg) { console.log(msg) }
function info(msg) { console.log(`${c.cyan}ℹ${c.reset} ${msg}`) }
function success(msg) { console.log(`${c.green}✓${c.reset} ${msg}`) }
function warn(msg) { console.log(`${c.yellow}⚠${c.reset} ${msg}`) }
function error(msg) { console.error(`${c.red}✗${c.reset} ${msg}`) }

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    })
  } catch (err) {
    if (options.silent) return null
    throw err
  }
}

// ---------------------------------------------------------------------------
// Package info helpers
// ---------------------------------------------------------------------------

function readPackageJson(pkgPath) {
  const file = join(ROOT, pkgPath, 'package.json')
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writePackageJson(pkgPath, data) {
  const file = join(ROOT, pkgPath, 'package.json')
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

function getLocalVersion(pkgPath) {
  return readPackageJson(pkgPath)?.version || null
}

/**
 * Get workspace:* dependencies for a package (only those in our PACKAGES list).
 */
function getWorkspaceDeps(pkgPath) {
  const pkg = readPackageJson(pkgPath)
  if (!pkg) return []

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
    ...pkg.optionalDependencies,
  }

  return Object.entries(allDeps)
    .filter(([, v]) => v === 'workspace:*')
    .map(([name]) => name)
    .filter((name) => PACKAGES.some((p) => p.name === name))
}

// ---------------------------------------------------------------------------
// npm helpers
// ---------------------------------------------------------------------------

function checkNpmAuth() {
  try {
    const username = exec('npm whoami 2>/dev/null', { silent: true })?.trim()
    return { loggedIn: !!username, username }
  } catch {
    return { loggedIn: false, username: null }
  }
}

function getNpmVersion(pkgName) {
  try {
    const result = exec(`npm view ${pkgName} version 2>/dev/null`, { silent: true })
    return result?.trim() || null
  } catch {
    return null
  }
}

function isVersionOnNpm(pkgName, version) {
  try {
    const result = exec(`npm view ${pkgName}@${version} version 2>/dev/null`, { silent: true })
    return result?.trim() === version
  } catch {
    return false
  }
}

/**
 * Get all dependency versions from the published npm package.
 */
function getNpmDependencies(pkgName) {
  try {
    const result = exec(
      `npm view ${pkgName} dependencies peerDependencies optionalDependencies --json 2>/dev/null`,
      { silent: true },
    )
    if (!result || result.trim() === '') return {}
    const parsed = JSON.parse(result)
    if (parsed.dependencies || parsed.peerDependencies || parsed.optionalDependencies) {
      return {
        ...parsed.dependencies,
        ...parsed.peerDependencies,
        ...parsed.optionalDependencies,
      }
    }
    return parsed
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Git helpers (monorepo — single repo, not submodules)
// ---------------------------------------------------------------------------

function hasUncommittedChanges() {
  const status = exec('git status --porcelain', { silent: true })
  return status && status.trim().length > 0
}

/**
 * Check if a package directory has commits since a given tag.
 */
function hasChangesSinceTag(pkgPath, tag) {
  try {
    // Check if tag exists
    const tagExists = exec(`git tag -l "${tag}"`, { silent: true })?.trim()
    if (!tagExists) return true // No tag = treat as changed

    const result = exec(
      `git log ${tag}..HEAD --oneline -- ${pkgPath}/ 2>/dev/null | wc -l`,
      { silent: true },
    )
    return parseInt(result?.trim() || '0', 10) > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Version bump helpers
// ---------------------------------------------------------------------------

function bumpVersion(version, level) {
  const parts = version.split('.').map(Number)
  if (level === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0 }
  else if (level === 'minor') { parts[1]++; parts[2] = 0 }
  else { parts[2]++ }
  return parts.join('.')
}

/**
 * Update version in package.json and resolve workspace:* deps to real versions.
 * Returns the new version.
 */
function updatePackageVersion(pkgPath, newVersion, resolvedDeps) {
  const pkg = readPackageJson(pkgPath)
  pkg.version = newVersion

  // Resolve workspace:* to actual versions for publishing
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!pkg[depType]) continue
    for (const [name, ver] of Object.entries(pkg[depType])) {
      if (ver === 'workspace:*' && resolvedDeps[name]) {
        pkg[depType][name] = resolvedDeps[name]
      }
    }
  }

  writePackageJson(pkgPath, pkg)
  return newVersion
}

/**
 * Restore workspace:* protocol after publishing.
 */
function restoreWorkspaceProtocol(pkgPath) {
  const pkg = readPackageJson(pkgPath)

  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!pkg[depType]) continue
    for (const [name] of Object.entries(pkg[depType])) {
      if (PACKAGES.some((p) => p.name === name)) {
        pkg[depType][name] = 'workspace:*'
      }
    }
  }

  writePackageJson(pkgPath, pkg)
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function analyzePackages() {
  log(`\n${c.bright}Analyzing packages...${c.reset}\n`)

  const results = []

  // Pass 1: gather basic info
  for (const pkg of PACKAGES) {
    const localVersion = getLocalVersion(pkg.path)
    const npmVersion = getNpmVersion(pkg.name)
    const npmDeps = getNpmDependencies(pkg.name)
    const workspaceDeps = getWorkspaceDeps(pkg.path)

    results.push({
      ...pkg,
      localVersion,
      npmVersion,
      npmDeps,
      workspaceDeps,
      needsPublish: false,
      reasons: [],
    })
  }

  // Pass 2: detect directly changed packages
  for (const pkg of results) {
    const reasons = []

    if (!pkg.npmVersion) {
      reasons.push('not published to npm')
    } else if (pkg.localVersion !== pkg.npmVersion) {
      reasons.push(`version ${pkg.npmVersion} → ${pkg.localVersion}`)
    } else {
      // Check for source changes since the last published version tag
      const tag = `${pkg.name}@${pkg.npmVersion}`
      if (hasChangesSinceTag(pkg.path, tag)) {
        reasons.push('has changes since last publish')
      }
    }

    if (reasons.length > 0) {
      pkg.needsPublish = true
      pkg.reasons = reasons
    }
  }

  // Pass 3: predict published versions
  function predictVersion(pkg) {
    if (!pkg.needsPublish) return pkg.npmVersion
    if (pkg.localVersion === pkg.npmVersion) {
      // Will be auto-bumped patch
      return bumpVersion(pkg.localVersion, 'patch')
    }
    return pkg.localVersion
  }

  // Pass 4: cascade dependency updates — iterate until stable
  let changed = true
  while (changed) {
    changed = false

    for (const pkg of results) {
      if (pkg.needsPublish) continue

      const reasons = []

      for (const depName of pkg.workspaceDeps) {
        const depPkg = results.find((p) => p.name === depName)
        if (!depPkg) continue

        const npmDepVersion = pkg.npmDeps[depName]
        const predictedDepVersion = predictVersion(depPkg)

        if (npmDepVersion !== predictedDepVersion) {
          reasons.push(`${depName} ${npmDepVersion || 'missing'} → ${predictedDepVersion}`)
        }
      }

      if (reasons.length > 0) {
        pkg.needsPublish = true
        pkg.reasons = reasons
        changed = true
      }
    }
  }

  // Display results
  for (const pkg of results) {
    const icon = pkg.needsPublish ? `${c.yellow}●${c.reset}` : `${c.green}✓${c.reset}`
    const versionInfo = pkg.npmVersion
      ? `${pkg.npmVersion}${pkg.localVersion !== pkg.npmVersion ? ` → ${pkg.localVersion}` : ''}`
      : `${pkg.localVersion} (new)`

    log(`  ${icon} ${pkg.name} ${c.dim}${versionInfo}${c.reset}`)

    if (pkg.needsPublish) {
      for (const reason of pkg.reasons) {
        log(`      ${c.yellow}→ ${reason}${c.reset}`)
      }
    }

    if (pkg.workspaceDeps.length > 0 && !pkg.needsPublish) {
      log(`      ${c.dim}deps: ${pkg.workspaceDeps.join(', ')}${c.reset}`)
    }

    log('')
  }

  return results
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

async function publishPackages(toPublish, allResults, options) {
  const { dryRun, bump } = options

  // Build a map of resolved versions (what each package will be after publish)
  const resolvedVersions = {}
  for (const pkg of allResults) {
    if (pkg.needsPublish) {
      const effectiveBump = bump || (pkg.npmVersion === pkg.localVersion ? 'patch' : null)
      resolvedVersions[pkg.name] = effectiveBump
        ? bumpVersion(pkg.localVersion, effectiveBump)
        : pkg.localVersion
    } else {
      resolvedVersions[pkg.name] = pkg.npmVersion || pkg.localVersion
    }
  }

  const published = []

  for (const pkg of toPublish) {
    const fullPath = join(ROOT, pkg.path)
    const newVersion = resolvedVersions[pkg.name]

    log(`\n${c.bright}${c.cyan}Publishing ${pkg.name}@${newVersion}${c.reset}`)
    log(`${c.dim}${'─'.repeat(40)}${c.reset}`)

    if (dryRun) {
      log(`  ${c.dim}[dry-run] version → ${newVersion}${c.reset}`)
      log(`  ${c.dim}[dry-run] resolve workspace deps${c.reset}`)
      log(`  ${c.dim}[dry-run] pnpm publish --access public${c.reset}`)
      log(`  ${c.dim}[dry-run] restore workspace:* protocol${c.reset}`)
      published.push(pkg)
      continue
    }

    // Check if already on npm
    if (isVersionOnNpm(pkg.name, newVersion)) {
      warn(`${pkg.name}@${newVersion} already on npm — skipping`)
      published.push(pkg)
      continue
    }

    // Update version + resolve workspace:* deps to real versions
    updatePackageVersion(pkg.path, newVersion, resolvedVersions)

    // Publish
    try {
      info(`Publishing to npm...`)
      exec(`pnpm publish --access public --no-git-checks`, { cwd: fullPath })
      success(`Published ${pkg.name}@${newVersion}`)
      published.push(pkg)
    } catch (err) {
      error(`Failed to publish ${pkg.name}: ${err.message}`)
      // Restore workspace protocol before bailing
      restoreWorkspaceProtocol(pkg.path)
      break
    }

    // Restore workspace:* protocol in package.json
    restoreWorkspaceProtocol(pkg.path)
  }

  // Commit all version bumps in a single commit
  if (!dryRun && published.length > 0) {
    log(`\n${c.bright}${c.cyan}Committing version bumps${c.reset}`)
    log(`${c.dim}${'─'.repeat(40)}${c.reset}`)

    // Stage all package.json changes
    for (const pkg of published) {
      exec(`git add ${pkg.path}/package.json`)
    }

    const names = published.map((p) => p.name.replace('@citestyle/', '')).join(', ')
    const versions = [...new Set(published.map((p) => resolvedVersions[p.name]))]
    const versionLabel = versions.length === 1 ? versions[0] : 'multiple'

    exec(`git commit -m "release: ${names} (${versionLabel})"`)

    // Tag each published package
    for (const pkg of published) {
      const tag = `${pkg.name}@${resolvedVersions[pkg.name]}`
      exec(`git tag "${tag}"`)
    }

    exec('git push && git push --tags')
    success('Pushed commits and tags')
  }

  return published
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun =
    !args.includes('--publish') &&
    !args.includes('--patch') &&
    !args.includes('--minor') &&
    !args.includes('--major')
  const bump = args.includes('--patch')
    ? 'patch'
    : args.includes('--minor')
      ? 'minor'
      : args.includes('--major')
        ? 'major'
        : null

  log(`\n${c.bright}${c.cyan}═══════════════════════════════════════${c.reset}`)
  log(`${c.bright}${c.cyan}  Citestyle Package Publisher${c.reset}`)
  log(`${c.bright}${c.cyan}═══════════════════════════════════════${c.reset}`)

  // Check npm auth
  if (!dryRun) {
    const { loggedIn, username } = checkNpmAuth()
    if (!loggedIn) {
      log('')
      error('You are not logged in to npm!')
      log(`  Run: ${c.cyan}npm login${c.reset}`)
      log('')
      process.exit(1)
    }
    success(`Logged in to npm as ${c.cyan}${username}${c.reset}`)
  }

  if (dryRun) {
    warn('DRY RUN MODE — No changes will be made')
    log(`${c.dim}  Use --publish to publish without version bump`)
    log(`  Use --patch, --minor, or --major to bump and publish${c.reset}`)
  } else {
    log(`${c.green}PUBLISH MODE${c.reset}${bump ? ` — Bumping ${bump} version` : ''}`)
  }

  // Check for uncommitted changes
  if (!dryRun && hasUncommittedChanges()) {
    log('')
    error('Uncommitted changes detected. Commit or stash before publishing.')
    log(`  Run: ${c.cyan}git status${c.reset}`)
    log('')
    process.exit(1)
  }

  // Analyze
  const packages = analyzePackages()
  const toPublish = packages.filter((p) => p.needsPublish)

  if (toPublish.length === 0) {
    success('All packages are up to date!')
    return
  }

  // Dry run summary
  if (dryRun) {
    log(`\n${c.bright}${c.cyan}═══════════════════════════════════════${c.reset}`)
    log(`${c.bright}Will publish:${c.reset}\n`)

    for (const pkg of toPublish) {
      const needsAutoBump = !bump && pkg.npmVersion === pkg.localVersion
      const versionDisplay = needsAutoBump
        ? `${pkg.localVersion} ${c.yellow}(will auto-bump patch)${c.reset}`
        : pkg.localVersion

      log(`  ${c.cyan}${pkg.name}${c.reset} ${c.dim}${versionDisplay}${c.reset}`)
      for (const reason of pkg.reasons) {
        log(`    ${c.yellow}→ ${reason}${c.reset}`)
      }
    }

    log('')
    log(`${c.dim}Run with --patch to bump versions and publish${c.reset}`)
    log(`${c.dim}Run with --publish to publish without version bump${c.reset}`)
    log('')
    return
  }

  // Confirmation
  log(`\n${c.bright}Packages to publish:${c.reset}`)
  for (const pkg of toPublish) {
    log(`  ${c.cyan}→${c.reset} ${pkg.name}`)
  }

  const { createInterface } = await import('readline')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const confirmed = await new Promise((resolve) => {
    rl.question(
      `\n${c.yellow}Proceed with publishing? (y/N)${c.reset} `,
      (answer) => {
        rl.close()
        resolve(answer.toLowerCase() === 'y')
      },
    )
  })

  if (!confirmed) {
    log('\nAborted.')
    return
  }

  // Publish
  const published = await publishPackages(toPublish, packages, { dryRun: false, bump })

  // Summary
  log(`\n${c.bright}${c.cyan}═══════════════════════════════════════${c.reset}`)
  success(`Published ${published.length} package(s)`)
  log('')
}

main().catch((err) => {
  error(err.message)
  process.exit(1)
})
