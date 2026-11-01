// ─── The models a federation depends on, from git ────────────────────────────
//
// Each dependency in deps.json names a git repository, the model folder in it
// and a pinned ref. Its model is read from a cache: one bare partial clone per
// repository (trees only, blobs fetched as needed), under the user's cache
// directory, so a hundred code repositories cost their model files, not their
// code. A ref that is a commit the cache already holds needs no network.

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { deserializeFromMdFolder, isMdFolderModelPath, type FolderFiles } from '@radical/common/formats/mdFolder'
import type { Dependency, FetchedDependency } from '@radical/common/federation'
import { catFiles } from './gitModel'

const exec = promisify(execFile)

async function git(cwd: string, args: string[], input?: string): Promise<string> {
  const run = exec('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8', windowsHide: true })
  if (input !== undefined) run.child.stdin?.end(input)
  const { stdout } = await run
  return stdout.trim()
}

const gitOk = (cwd: string, args: string[]): Promise<string | null> => git(cwd, args).catch(() => null)

/** Where fetched repositories are kept: $RADICAL_CACHE, else the user's cache. */
export function depsCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.RADICAL_CACHE) return resolve(env.RADICAL_CACHE)
  const base = env.XDG_CACHE_HOME || (process.platform === 'darwin' ? join(homedir(), 'Library', 'Caches') : join(homedir(), '.cache'))
  return join(base, 'radical')
}

/** An address git fetches from (https://, ssh://, git@host:path), not a path. */
const isAddress = (repo: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(repo) || /^[^/\\]+@[^/\\]+:/.test(repo)

/** The repository's address; a path is relative to the model folder. */
export const repoAddress = (repo: string, home: string): string => (isAddress(repo) || isAbsolute(repo) ? repo : resolve(home, repo))

/** The cache's clone of the repository, made on first use. */
async function cacheRepo(address: string, cacheDir: string): Promise<string> {
  const dir = join(cacheDir, 'repos', createHash('sha1').update(address).digest('hex').slice(0, 16))
  if (!(await stat(join(dir, 'HEAD')).then(() => true, () => false))) {
    await mkdir(dir, { recursive: true })
    await git(dir, ['init', '-q', '--bare'])
    await git(dir, ['remote', 'add', 'origin', address])
    // A partial clone: trees come with a fetch, blobs only when read.
    await git(dir, ['config', 'remote.origin.promisor', 'true'])
    await git(dir, ['config', 'remote.origin.partialclonefilter', 'blob:none'])
  }
  return dir
}

const FULL_SHA = /^[0-9a-f]{40}$/i

/** The commit `ref` names in the repository, fetched into the cache. */
async function fetchRef(dir: string, dep: Dependency): Promise<string> {
  if (FULL_SHA.test(dep.ref)) {
    const known = await gitOk(dir, ['rev-parse', '--verify', '--quiet', `${dep.ref}^{commit}`])
    if (known) return known
  }
  const fetch = ['-c', 'protocol.version=2', 'fetch', '-q', '--no-tags', '--filter=blob:none', 'origin']
  // One commit, shallow; a commit no branch ends at needs the history.
  let fetched = await git(dir, [...fetch, '--depth', '1', dep.ref]).then(() => true, () => false)
  if (!fetched) {
    fetched = await git(dir, [...fetch, '+refs/heads/*:refs/remotes/origin/*', '+refs/tags/*:refs/tags/*']).then(() => true, () => false)
    if (!fetched) throw new Error(`could not fetch from ${await git(dir, ['remote', 'get-url', 'origin'])}`)
    const commit = await gitOk(dir, ['rev-parse', '--verify', '--quiet', `${dep.ref}^{commit}`])
      ?? await gitOk(dir, ['rev-parse', '--verify', '--quiet', `origin/${dep.ref}^{commit}`])
    if (!commit) throw new Error(`the repository has no branch, tag or commit "${dep.ref}"`)
    return commit
  }
  return git(dir, ['rev-parse', 'FETCH_HEAD^{commit}'])
}

/** The model files under `path` at `commit`, blobs fetched in one go. */
async function modelFilesAt(dir: string, commit: string, path: string): Promise<FolderFiles> {
  const folder = path.replace(/^\.\/?|\/$/g, '')
  const tree = folder ? `${commit}:${folder}` : `${commit}^{tree}`
  const listing = await gitOk(dir, ['ls-tree', '-r', '-z', tree])
  if (listing === null) return {}
  const blobs: Array<{ sha: string; path: string }> = []
  for (const entry of listing.split('\0')) {
    const tab = entry.indexOf('\t')
    if (tab < 0) continue
    const [mode, type, sha] = entry.slice(0, tab).split(' ')
    const rel = entry.slice(tab + 1)
    if (type !== 'blob' || mode === '120000' || !isMdFolderModelPath(rel)) continue
    if (rel.split('/').some((part) => part.startsWith('.'))) continue
    blobs.push({ sha, path: rel })
  }
  if (!blobs.length) return {}
  // The blobs a partial clone lacks, asked for at once rather than one by one.
  const check = await git(dir, ['cat-file', '--batch-check=%(objectname)', '--batch-all-objects']).catch(() => '')
  const present = new Set(check.split('\n'))
  const missing = blobs.map((b) => b.sha).filter((sha) => !present.has(sha))
  if (missing.length) {
    await git(dir, ['-c', 'fetch.negotiationAlgorithm=noop', 'fetch', '-q', 'origin', '--no-tags', '--no-write-fetch-head', '--recurse-submodules=no', '--filter=blob:none', '--stdin'], missing.join('\n') + '\n')
  }
  const contents = await catFiles(dir, blobs.map((b) => b.sha))
  return Object.fromEntries(blobs.map((b, i) => [b.path, contents[i]]))
}

export interface FetchOptions {
  /** The cache directory (default: depsCacheDir()). */
  cacheDir?: string
  /** Use this commit instead of resolving the ref (the one the federation
   *  was composed with); fetched when the cache lacks it. */
  commit?: string
}

/** The dependency's model at its pinned ref, from the cache, fetched first
 *  when the cache lacks it. `home` is the model folder its repo path is
 *  relative to. */
export async function fetchDependency(dep: Dependency, home: string, options: FetchOptions = {}): Promise<FetchedDependency> {
  const address = repoAddress(dep.repo, home)
  try {
    const dir = await cacheRepo(address, options.cacheDir ?? depsCacheDir())
    const commit = options.commit
      ? await gitOk(dir, ['rev-parse', '--verify', '--quiet', `${options.commit}^{commit}`]) ?? await fetchRef(dir, { ...dep, ref: options.commit })
      : await fetchRef(dir, dep)
    const files = await modelFilesAt(dir, commit, dep.path)
    if (!Object.keys(files).length) throw new Error(`no model folder "${dep.path}" at ${dep.ref} (${commit.slice(0, 7)})`)
    const { nodes, relations } = deserializeFromMdFolder(files).data
    return { ...dep, commit, data: { nodes, relations } }
  } catch (error) {
    throw new Error(`dependency ${dep.name} (${dep.repo} at ${dep.ref}): ${(error as Error).message}`)
  }
}
