#!/usr/bin/env node
// Releases radical.tools: one product version for the CLI, the MCP server,
// the Desktop app and the VS Code extension (ADR "Product and format
// versioning").
//
//   npm run release -- <version | major | minor | patch>
//       On a branch (made release/v<version> when run on main): sets the
//       version in the four package.json files and the lockfile, moves the
//       changelog's Unreleased entries under the version and today's date, and
//       commits. Merging that pull request is the release decision.
//   npm run release:tag
//       On main, up to date, after that merge: tags the commit v<version>.
//       Pushing the tag (the command it prints) starts release.yml and
//       vscode-publish.yml; npm-publish.yml publishes the CLI and the MCP
//       server from main by hand.
//   node tools/release.mjs check <tag>
//       What the workflows a tag starts run first: the four versions are the
//       tag's and the changelog has its section.
//   node tools/release.mjs notes <version>
//       The changelog section of a version, for the GitHub Release.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPOSITORY = 'https://github.com/radicaltools/radical.tools'

/** The released artifacts, which carry the product version. */
export const PRODUCT_PACKAGES = ['apps/cli', 'apps/mcp', 'apps/studio', 'apps/vscode']

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** The version each released artifact carries, by its folder. */
export function productVersions(root = ROOT) {
  return Object.fromEntries(PRODUCT_PACKAGES.map((dir) => [dir, JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).version]))
}

/** The one version the artifacts carry; throws, naming them, when they differ. */
export function productVersion(root = ROOT) {
  const versions = productVersions(root)
  const distinct = [...new Set(Object.values(versions))]
  if (distinct.length !== 1) {
    throw new Error(`The released packages carry different versions: ${Object.entries(versions).map(([dir, v]) => `${dir} ${v}`).join(', ')}. Run npm run release to set one.`)
  }
  return distinct[0]
}

/** The version after `current` for `spec`: major, minor, patch, or a version
 *  given (which must be newer). */
export function nextVersion(current, spec) {
  const m = SEMVER.exec(current)
  if (!m) throw new Error(`${current} is no version.`)
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (spec === 'major') return `${major + 1}.0.0`
  if (spec === 'minor') return `${major}.${minor + 1}.0`
  if (spec === 'patch') return m[4] ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch + 1}`
  const given = String(spec ?? '').replace(/^v/, '')
  if (!SEMVER.test(given)) throw new Error(`Give a version (0.3.0, 1.0.0-rc.1) or major, minor or patch, not "${spec ?? ''}".`)
  if (compare(given, current) <= 0) throw new Error(`${given} is not newer than ${current}.`)
  return given
}

/** SemVer precedence of two versions (negative when `a` is older). */
function compare(a, b) {
  const x = SEMVER.exec(a)
  const y = SEMVER.exec(b)
  for (let i = 1; i <= 3; i++) if (Number(x[i]) !== Number(y[i])) return Number(x[i]) - Number(y[i])
  if (!x[4] || !y[4]) return (x[4] ? -1 : 0) - (y[4] ? -1 : 0)
  return x[4] < y[4] ? -1 : x[4] > y[4] ? 1 : 0
}

const UNRELEASED = /^## \[Unreleased\][^\n]*\n/m

/** The sections of a changelog: the `## [x]` headings and where they start. */
function sections(text) {
  return [...text.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)].map((m) => ({ name: m[1], start: m.index }))
}

/** The body of the changelog section `name`, or null when there is none. */
export function changelogSection(text, name) {
  const all = sections(text)
  const i = all.findIndex((s) => s.name === name)
  if (i < 0) return null
  const end = all[i + 1]?.start ?? text.search(/^\[[^\]]+\]: /m)
  const body = text.slice(text.indexOf('\n', all[i].start) + 1, end < 0 ? undefined : end)
  return body.trim()
}

/** The changelog with the Unreleased entries moved under `version` and
 *  `date`, an empty Unreleased section left above it, and the links at the
 *  end updated. Throws when Unreleased says nothing. */
export function cutChangelog(text, version, date) {
  if (!UNRELEASED.test(text)) throw new Error('CHANGELOG.md has no ## [Unreleased] section.')
  const entries = changelogSection(text, 'Unreleased')
  if (!entries) throw new Error('The Unreleased section of CHANGELOG.md is empty: write what this release changes first.')
  if (changelogSection(text, version) !== null) throw new Error(`CHANGELOG.md already has a section for ${version}.`)
  const previous = sections(text).find((s) => s.name !== 'Unreleased')?.name
  let out = text.replace(UNRELEASED, `## [Unreleased]\n\n## [${version}] - ${date}\n`)
  const link = previous ? `${REPOSITORY}/compare/v${previous}...v${version}` : `${REPOSITORY}/releases/tag/v${version}`
  const unreleasedLink = /^\[Unreleased\]: .*$/m
  const links = `[Unreleased]: ${REPOSITORY}/compare/v${version}...HEAD\n[${version}]: ${link}`
  out = unreleasedLink.test(out) ? out.replace(unreleasedLink, links) : `${out.trimEnd()}\n\n${links}\n`
  return out
}

/** `text` (a package.json) with its version set to `version`, nothing else changed. */
export function setPackageVersion(text, version) {
  const re = /^(\s*"version"\s*:\s*)"[^"]*"/m
  if (!re.test(text)) throw new Error('package.json has no version.')
  return text.replace(re, `$1"${version}"`)
}

/** `text` (package-lock.json) with the released workspaces at `version`.
 *  Edited in place rather than by npm install, which would rewrite the
 *  lockfile in the format of whichever npm runs it. */
export function setLockVersions(text, version) {
  let out = text
  for (const dir of PRODUCT_PACKAGES) {
    const re = new RegExp(`(\\n    "${dir.replace('/', '\\/')}": \\{\\n(?:      "name": "[^"]*",\\n)?      "version": )"[^"]*"`)
    if (!re.test(out)) throw new Error(`package-lock.json has no entry for ${dir}.`)
    out = out.replace(re, `$1"${version}"`)
  }
  return out
}

/** What is wrong with releasing `tag` from `root`; empty when nothing is. */
export function tagProblems(root, tag) {
  const problems = []
  const version = tag.replace(/^v/, '')
  for (const [dir, v] of Object.entries(productVersions(root))) {
    if (v !== version) problems.push(`${dir}/package.json carries ${v}, not ${version}.`)
  }
  if (changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version) === null) problems.push(`CHANGELOG.md has no section for ${version}.`)
  return problems
}

// ─── Command line ────────────────────────────────────────────────────────────

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function prepare(spec) {
  if (git('status', '--porcelain')) fail('The working tree has changes. Commit or stash them first.')
  const current = productVersion()
  const version = nextVersion(current, spec)
  const changelog = join(ROOT, 'CHANGELOG.md')
  const cut = cutChangelog(readFileSync(changelog, 'utf8'), version, new Date().toISOString().slice(0, 10))
  if (git('rev-parse', '--abbrev-ref', 'HEAD') === 'main') git('switch', '-c', `release/v${version}`)
  for (const dir of PRODUCT_PACKAGES) {
    const file = join(ROOT, dir, 'package.json')
    writeFileSync(file, setPackageVersion(readFileSync(file, 'utf8'), version))
  }
  writeFileSync(changelog, cut)
  const lock = join(ROOT, 'package-lock.json')
  writeFileSync(lock, setLockVersions(readFileSync(lock, 'utf8'), version))
  git('add', 'CHANGELOG.md', 'package-lock.json', ...PRODUCT_PACKAGES.map((dir) => `${dir}/package.json`))
  git('commit', '-m', `release: v${version}`)
  console.log(`\nRelease v${version} prepared (${current} → ${version}) on ${git('rev-parse', '--abbrev-ref', 'HEAD')}.`)
  console.log('Push the branch and open a pull request. Once it is merged, run on main:\n  git switch main && git pull && npm run release:tag')
}

function tag() {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Tag a release on main, after its pull request is merged.')
  if (git('status', '--porcelain')) fail('The working tree has changes.')
  git('fetch', '--quiet', 'origin', 'main', '--tags')
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) fail('main is not origin/main: git pull first.')
  const version = productVersion()
  const name = `v${version}`
  const problems = tagProblems(ROOT, name)
  if (problems.length) fail(problems.join('\n'))
  if (git('tag', '--list', name)) fail(`${name} is tagged already.`)
  git('tag', '-a', name, '-m', `radical ${version}`)
  console.log(`Tagged ${git('rev-parse', '--short', 'HEAD')} ${name}. Push it to start the release workflows:\n  git push origin ${name}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, arg] = process.argv.slice(2)
  try {
    if (command === 'prepare') prepare(arg)
    else if (command === 'tag') tag()
    else if (command === 'check') {
      const problems = tagProblems(ROOT, arg ?? '')
      if (problems.length) fail(problems.map((p) => `::error::${p}`).join('\n'))
      console.log(`${arg}: the four packages carry its version and CHANGELOG.md has its section.`)
    } else if (command === 'notes') {
      const notes = changelogSection(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'), (arg ?? '').replace(/^v/, ''))
      if (notes === null) fail(`CHANGELOG.md has no section for ${arg}.`)
      console.log(notes)
    } else fail('Usage: node tools/release.mjs prepare <version | major | minor | patch> | tag | check <tag> | notes <version>')
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e))
  }
}
