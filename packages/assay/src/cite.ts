// ─── Radical Assay: code cited by the agent ──────────────────────────────────
//
// Where no extractor reads a repository (VB6, COBOL, Delphi, …), the agent
// reads the code itself and cites it: the repository, the file, the lines
// and the text it quotes from them (ADR Radical Assay). The server checks
// the quotation is there, ignoring spacing, and takes it as evidence of an
// inferred claim only. An element built from no unit names its folders.

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, sep } from 'node:path'
import type { RepositoryFacts } from './facts'
import { decodeText } from './files'
import { within } from './sources'

/** Lines of the repository's file the agent quotes. */
export interface Citation {
  repository: string
  /** From the repository's root. */
  file: string
  /** The first and last line, 1-based. */
  lines: [number, number]
  /** Words of those lines, as they are written there (spacing aside). */
  text: string
}

/** A folder or file of a repository an element is built in. */
export interface PlanPath {
  repository: string
  path: string
}

/** At most this many lines are quoted at once. */
const MAX_LINES = 40
/** A file bigger than this is not read for a quotation. */
const MAX_BYTES = 20_000_000
/** A quotation says something only from this many characters on (spacing aside). */
const MIN_QUOTE = 8

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** The path inside `dir`, or null when it leads out of it. */
export function inside(dir: string, path: string): string | null {
  if (isAbsolute(path)) return null
  const full = join(dir, path)
  if (!existsSync(full)) return null
  const real = realpathSync(dir)
  const target = realpathSync(full)
  return target === real || within(real, target) ? full : null
}

/** Why `citation` does not hold, or null when the quoted text is in those lines. */
export function citationProblem(citation: unknown, repositories: RepositoryFacts[]): string | null {
  const c = citation as Partial<Citation> | null
  if (!c || typeof c !== 'object') return 'a citation must be an object with repository, file, lines and text'
  const repo = repositories.find((r) => r.repository === c.repository)
  if (!repo) return `cites repository ${String(c.repository)}, which is not one of the run's`
  if (typeof c.file !== 'string' || !c.file) return 'a citation needs the file, from the repository\'s root'
  const file = inside(repo.dir, c.file)
  if (!file || !statSync(file).isFile()) return `cites ${c.repository}/${c.file}, which the repository does not have`
  const [from, to] = Array.isArray(c.lines) ? c.lines : []
  if (!Number.isInteger(from) || !Number.isInteger(to) || from! < 1 || to! < from!) return `cites ${c.repository}/${c.file} with lines ${JSON.stringify(c.lines)}: give [first, last], from 1`
  if (to! - from! >= MAX_LINES) return `cites ${c.repository}/${c.file}:${from}-${to}: quote at most ${MAX_LINES} lines at once`
  if (typeof c.text !== 'string' || !squash(c.text)) return `cites ${c.repository}/${c.file}:${from}-${to} without the text it quotes`
  if (squash(c.text).replace(/\s/g, '').length < MIN_QUOTE) return `cites ${c.repository}/${c.file}:${from}-${to} with "${squash(c.text)}": quote at least ${MIN_QUOTE} characters of it`
  if (statSync(file).size > MAX_BYTES) return `cites ${c.repository}/${c.file}, which is bigger than ${MAX_BYTES / 1e6} MB: quote a smaller file`
  const all = decodeText(readFileSync(file)).split(/\r?\n/)
  if (to! > all.length) return `cites ${c.repository}/${c.file}:${from}-${to}, but the file has ${all.length} lines`
  // Found where it starts and ends a word: "ort = 1" is no quotation of "export const port = 1".
  const lines = squash(all.slice(from! - 1, to!).join('\n'))
  const quote = squash(c.text)
  const word = (ch: string | undefined) => !!ch && /\w/.test(ch)
  let at = lines.indexOf(quote)
  while (at >= 0 && ((word(quote[0]) && word(lines[at - 1])) || (word(quote[quote.length - 1]) && word(lines[at + quote.length])))) at = lines.indexOf(quote, at + 1)
  if (at < 0) {
    return `cites ${c.repository}/${c.file}:${from}-${to}, whose lines do not hold "${squash(c.text).slice(0, 80)}"`
  }
  return null
}

/** Why `path` is no folder or file of its repository, or null. */
export function pathProblem(path: unknown, repositories: RepositoryFacts[]): string | null {
  const p = path as Partial<PlanPath> | null
  if (!p || typeof p !== 'object') return 'a path must be an object with repository and path'
  const repo = repositories.find((r) => r.repository === p.repository)
  if (!repo) return `names repository ${String(p.repository)}, which is not one of the run's`
  if (typeof p.path !== 'string' || !p.path) return 'a path needs the folder, from the repository\'s root'
  if (!inside(repo.dir, p.path)) return `names ${p.repository}/${p.path}, which the repository does not have`
  return null
}

/** The path as .radical/radical.json keeps it: from the root, with "/". */
export const cleanPath = (path: string): string => path.split(sep).join('/').replace(/^\.\//, '').replace(/\/+$/, '') || '.'
