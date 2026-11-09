// ─── Radical Assay: a repository's files ─────────────────────────────────────
//
// One walk of the repository, shared by every reader: its files from the
// root, outside what builds and package managers make and outside the
// repositories nested in it, each read once.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import type { Unit } from './facts'

/** Folders that hold no source of the repository's own. */
export const SKIPPED = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '.turbo', '.cache', '.radical', 'vendor', 'target', '.venv', 'venv', '__pycache__', 'bin', 'obj', '.gradle', '.idea', '.vs', '.svelte-kit', 'storybook-static'])
/** Libraries copied into a web application's folder (ASP.NET's wwwroot/lib, Bower's components): not its own source. */
const VENDORED = /(^|\/)(wwwroot\/lib|bower_components)\//i
/** Files bigger than this are not read. */
const MAX_FILE = 1_000_000

export const posix = (path: string): string => path.split(sep).join('/')

/** Code a tool generated: its strings and calls are not the repository's own. */
export const GENERATED = /(\.pb\.go|_pb2(_grpc)?\.py|_grpc\.pb\.go|Grpc\.java|\.g\.cs|\.designer\.cs|\.min\.js|\.bundle\.js)$|(^|\/)(genproto|generated)\//i

/** A test's or a fixture's source file: its strings are not calls of the unit. */
export const TEST_FILE = /(^|\/)(tests?|__tests__|e2e|fixtures?|testdata)\/|\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.(go|py)$|Tests?\.(cs|java|cls)$/i

/** Windows-1252's characters at 0x80–0x9F, where Latin-1 has control characters (undefined ones kept). */
const CP1252 = '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178'

/** Text of a file's bytes, without a byte order mark: UTF-16 when its mark
 *  says so, UTF-8 unless it does not decode as such, else Windows-1252 (VB6,
 *  Word's exports, old configuration). */
export function decodeText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2, buffer.length - (buffer.length % 2)))
    return swapped.swap16().toString('utf16le')
  }
  const text = buffer.toString('utf8')
  if (!text.includes('\uFFFD')) return text.replace(/^\uFEFF/, '')
  return buffer.toString('latin1').replace(/[\u0080-\u009f]/g, (c) => CP1252[c.charCodeAt(0) - 0x80])
}

/** At most this many files of a folder of code are listed. */
const MAX_FILES = 200_000
/** Git, kept from running what a repository's configuration names. */
export const GIT = ['-c', 'core.fsmonitor=false']

interface Listing {
  files: string[]
  /** Repositories inside a folder of code, left out of its walk. */
  nested: string[]
  /** Files past MAX_FILES, left out. */
  more: number
  /** Listed by git: what it ignores (a build's output) is not there. */
  git?: boolean
}

/** The repository's files from its root: what git lists (tracked, and untracked
 *  not ignored) when it is a repository, else a walk (a folder of code, which
 *  may lie in another repository's ignored folder) that leaves out what
 *  builds and package managers make and the repositories inside it. */
function listFiles(root: string): Listing {
  try {
    if (!existsSync(join(root, '.git'))) throw new Error('no repository')
    const out = execFileSync('git', [...GIT, 'ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    // A nested repository is listed as its folder ("x/"); a submodule is no file.
    return { files: out.split('\0').filter((f) => f && !f.endsWith('/')).filter((f) => { try { return statSync(join(root, f)).isFile() } catch { return false } }), nested: [], more: 0, git: true }
  } catch {
    const listing: Listing = { files: [], nested: [], more: 0 }
    const walk = (dir: string): void => {
      let entries
      try { entries = readdirSync(join(root, dir), { withFileTypes: true }) } catch { return }
      for (const d of entries) {
        const path = dir ? `${dir}/${d.name}` : d.name
        if (d.isDirectory()) {
          if (SKIPPED.has(d.name)) continue
          if (existsSync(join(root, path, '.git'))) listing.nested.push(path)
          else walk(path)
        } else if (d.isFile()) {
          if (listing.files.length < MAX_FILES) listing.files.push(path)
          else listing.more++
        }
      }
    }
    walk('')
    return listing
  }
}

export class RepoFiles {
  readonly list: string[]
  private readonly set: Set<string>
  private readonly texts = new Map<string, string>()

  /** Repositories inside a folder of code, which its walk left out. */
  readonly nested: string[]
  /** Files past the most a folder of code lists, left out. */
  readonly more: number

  constructor(readonly root: string) {
    const listing = listFiles(root)
    // A build folder holding a .NET project is a build project's code (NUKE's build/_build.csproj), not output.
    const builds = new Set(listing.files.filter((f) => /(^|\/)build\/[^/]+\.(cs|fs)proj$/i.test(f)).map((f) => f.slice(0, f.lastIndexOf('/'))))
    // A compose file or a Dockerfile under build/ (build/docker/docker-compose.yml) is deployment written by hand.
    const deployment = (f: string): boolean => /(^|\/)build\//.test(f) && /(^|\/)((docker-)?compose[^/]*\.ya?ml|Dockerfile)$/i.test(f)
    // In a repository, a build folder git tracks holds what was written, not built (build/postgres/create_tables.sql):
    // a build's output is ignored, so git lists none of it.
    const skipped = (f: string): boolean => VENDORED.test(f) || (!deployment(f) && f.split('/').slice(0, -1).some((seg, i, segs) => SKIPPED.has(seg) && !(seg === 'build' && (listing.git || builds.has(segs.slice(0, i + 1).join('/'))))))
    this.list = listing.files.filter((f) => !skipped(f)).sort()
    this.set = new Set(this.list)
    this.nested = listing.nested.sort()
    this.more = listing.more
  }

  /** The file's text ('' when it is too big or unreadable), without a byte order mark; UTF-8 unless it does not decode as such. */
  read(file: string): string {
    const cached = this.texts.get(file)
    if (cached !== undefined) return cached
    let text = ''
    try {
      const full = join(this.root, file)
      if (statSync(full).size <= MAX_FILE) text = decodeText(readFileSync(full))
    } catch {
      // Unreadable: nothing.
    }
    this.texts.set(file, text)
    return text
  }

  /** The files whose name matches. */
  named(re: RegExp): string[] {
    return this.list.filter((f) => re.test(f.slice(f.lastIndexOf('/') + 1)))
  }

  has(file: string): boolean {
    return this.set.has(file)
  }
}

/** The 1-based line of the first match of `pattern` in `text` (after `from`), else 1. */
export function lineOf(text: string, pattern: RegExp | string, from = 0): number {
  const rest = text.slice(from)
  const at = typeof pattern === 'string' ? rest.indexOf(pattern) : rest.search(pattern)
  return at < 0 ? 1 : text.slice(0, from + at).split('\n').length
}

/** The 1-based line of character `index` of `text`. */
export const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length

export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const dirOf = (file: string): string => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.')

/** The unit whose folder holds `file`: the deepest one, the root unit last. */
export function owner(units: Unit[], file: string): Unit | undefined {
  let best: Unit | undefined
  for (const u of units) {
    const inside = u.path === '.' || file === u.path || file.startsWith(`${u.path}/`)
    if (inside && (!best || best.path === '.' || u.path.length > best.path.length)) best = u
  }
  if (best) return best
  // In no unit's folder: the unit building the shared code it is in (a Go module's packages beside its main ones).
  let at = -1
  for (const u of units) for (const s of u.shares ?? []) if ((s === '.' || file.startsWith(`${s}/`)) && s.length > at) { best = u; at = s.length }
  return best
}

/** A path relative to `base` (a folder from the root), Windows separators allowed, as a path from the root; null outside it. */
export function resolveFrom(base: string, relativePath: string): string | null {
  const parts = (base === '.' ? [] : base.split('/'))
  for (const seg of relativePath.replace(/\\/g, '/').split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') { if (!parts.length) return null; parts.pop() } else parts.push(seg)
  }
  return parts.join('/') || '.'
}
