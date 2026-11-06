// ─── Radical Assay: the run's repositories ───────────────────────────────────
//
// Assay reads only local directories, already cloned, and .zip files of code
// (ADR Radical Assay): a directory given is a repository when git says so
// (.git, a folder or a worktree's file), and otherwise stands for every
// repository directly inside it, or, when it holds nothing but folders, every
// repository up to three levels down; when it holds none, it is a folder of
// code itself. A .zip file is unpacked first (its .git folders left out),
// into a folder of its own in `unpackInto`; each repository it held is a
// folder of code of its own. Nothing is fetched, and nothing
// outside the directories given is read.

import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { SKIPPED } from './files'
import { safeName, unpackZip } from './sources'

export const isRepository = (dir: string): boolean => existsSync(join(dir, '.git'))

export interface Repositories {
  /** The repositories' folders, absolute, in the order given (a directory's by name). */
  dirs: string[]
  /** Directories that hold nothing. */
  empty: string[]
  /** What was left out of a directory given, said. */
  notes: string[]
}

/** How deep a directory of folders is searched for repositories. */
const DEPTH = 3
/** Files a directory of repositories may hold besides them. */
const ASIDE = /^(readme|license|licence|notice|changelog)(\.|$)/i

/** The repositories below `dir`, up to `depth` levels, by path. */
function repositoriesBelow(dir: string, depth: number): string[] {
  if (depth === 0) return []
  const found: string[] = []
  for (const d of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!d.isDirectory() || d.name.startsWith('.') || SKIPPED.has(d.name)) continue
    const path = join(dir, d.name)
    if (isRepository(path)) found.push(path)
    else found.push(...repositoriesBelow(path, depth - 1))
  }
  return found
}

/** True when `dir` holds folders and nothing else of its own (hidden files and a README aside). */
const onlyFolders = (dir: string): boolean =>
  readdirSync(dir, { withFileTypes: true }).every((d) => d.name.startsWith('.') || d.isDirectory() || ASIDE.test(d.name))

/** The repositories `given` (relative to `cwd`) stand for; a .zip file is
 *  unpacked into a folder of `unpackInto` named after it (apart from any
 *  other of the call's). */
export function repositoriesIn(given: string[], cwd = process.cwd(), unpackInto?: string): Repositories {
  const dirs: string[] = []
  const empty: string[] = []
  const notes: string[] = []
  const unpacked = new Set<string>()
  for (const entry of given) {
    let dir = resolve(cwd, entry)
    if (existsSync(dir) && statSync(dir).isFile() && /\.zip$/i.test(dir)) {
      if (!unpackInto) throw new Error(`${entry}: a .zip file needs a folder to be unpacked into`)
      let name = safeName(basename(dir).replace(/\.zip$/i, ''), 'code')
      for (let i = 2, base = name; unpacked.has(name.toLowerCase()); i++) name = `${base}-${i}`
      unpacked.add(name.toLowerCase())
      const into = join(unpackInto, name)
      const packed = unpackZip(dir, unpackInto, into)
      // Repositories packed in it, their .git folders left out, are folders of code each.
      if (packed.length && !packed.includes('')) {
        dirs.push(...packed.map((r) => join(into, r)))
        notes.push(`${entry} holds ${packed.length} repositor${packed.length === 1 ? 'y' : 'ies'} (${packed.join(', ')}): each is read as a folder of code, without its .git folder`)
        continue
      }
      dir = into
    }
    if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`${entry} is no directory or .zip file`)
    if (isRepository(dir)) {
      dirs.push(dir)
      continue
    }
    const folders = onlyFolders(dir)
    const inside = repositoriesBelow(dir, folders ? DEPTH : 1)
    if (inside.length && !folders) notes.push(`${entry} holds files of its own besides the repositories inside it: only the repositories are read (give the files' folder on its own to read them)`)
    if (inside.length) dirs.push(...inside)
    else if (readdirSync(dir).some((n) => !n.startsWith('.'))) dirs.push(dir)
    else empty.push(dir)
  }
  const unique = [...new Set(dirs)]
  const names = unique.map((d) => basename(d))
  const twice = names.filter((n, i) => names.indexOf(n) !== i)
  if (twice.length) throw new Error(`Two repositories are named ${[...new Set(twice)].join(', ')}: a run tells them apart by their folders' names`)
  return { dirs: unique, empty, notes }
}
